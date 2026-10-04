<?php

declare(strict_types=1);

namespace App\Services\Uploads;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Central upload pipeline (BE-05, SEC-FILE-01..05, NFR7).
 *
 * - Inspects actual file bytes/MIME, never trusting client extension/headers alone.
 * - Rejects SVG, HTML, and script payloads.
 * - Enforces 5 MB max per file.
 * - Re-encodes JPG/PNG images through GD to strip EXIF/GPS metadata and resize large images.
 * - Stores public photos on the `public` disk and verification/vet documents on the `local` (private) disk
 *   with random UUID filenames.
 */
class FileUploadService
{
    public const MAX_BYTES = 5 * 1024 * 1024;

    public const MAX_DIMENSION = 1920;

    public const PHOTO_MIMES = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
    ];

    public const DOCUMENT_MIMES = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'application/pdf' => 'pdf',
    ];

    /**
     * Validate, re-encode (stripping EXIF/GPS), and store a public photo on the `public` disk.
     *
     * @return array{file_path: string, mime_type: string, size_bytes: int, url: string}
     */
    public function storePublicPhoto(UploadedFile $file, string $directory = 'photos', string $field = 'photo'): array
    {
        $this->assertValidSize($file, $field);
        $mime = $this->detectAndValidateMime($file, self::PHOTO_MIMES, $field, 'Upload a JPG or PNG photo.');

        $encoded = $this->reencodeImage($file, $mime, $field);
        $ext = self::PHOTO_MIMES[$mime];
        $path = trim($directory, '/').'/'.Str::uuid()->toString().'.'.$ext;

        Storage::disk('public')->put($path, $encoded);

        return [
            'file_path' => $path,
            'mime_type' => $mime,
            'size_bytes' => strlen($encoded),
            'url' => Storage::disk('public')->url($path),
        ];
    }

    /**
     * Validate, process (re-encoding images to strip EXIF), and store a private document on the `local` disk.
     *
     * @return array{file_path: string, mime_type: string, size_bytes: int}
     */
    public function storePrivateDocument(UploadedFile $file, string $directory = 'verification', string $field = 'document'): array
    {
        $this->assertValidSize($file, $field);
        $mime = $this->detectAndValidateMime($file, self::DOCUMENT_MIMES, $field, 'Upload a JPG, PNG or PDF file.');

        $ext = self::DOCUMENT_MIMES[$mime];
        $path = trim($directory, '/').'/'.Str::uuid()->toString().'.'.$ext;

        if ($mime === 'application/pdf') {
            $contents = (string) file_get_contents($file->getRealPath());
            if (! str_starts_with($contents, '%PDF-')) {
                throw ValidationException::withMessages([$field => ['Upload a JPG, PNG or PDF file.']]);
            }
            $this->assertNoDangerousScriptPayload($contents, $field, 'Upload a JPG, PNG or PDF file.');
            Storage::disk('local')->put($path, $contents);

            return [
                'file_path' => $path,
                'mime_type' => $mime,
                'size_bytes' => strlen($contents),
            ];
        }

        $encoded = $this->reencodeImage($file, $mime, $field, 'Upload a JPG, PNG or PDF file.');
        Storage::disk('local')->put($path, $encoded);

        return [
            'file_path' => $path,
            'mime_type' => $mime,
            'size_bytes' => strlen($encoded),
        ];
    }

    private function assertValidSize(UploadedFile $file, string $field): void
    {
        $size = $file->getSize();
        if ($size === false || $size <= 0 || $size > self::MAX_BYTES) {
            throw ValidationException::withMessages([
                $field => ['Each file must be 5 MB or smaller.'],
            ]);
        }
    }

    /**
     * @param  array<string, string>  $allowedMimes
     */
    private function detectAndValidateMime(UploadedFile $file, array $allowedMimes, string $field, string $errorMessage): string
    {
        $realPath = $file->getRealPath();
        if ($realPath === false || ! is_file($realPath)) {
            throw ValidationException::withMessages([$field => [$errorMessage]]);
        }

        // Check client extension & raw head bytes against SVG / HTML / script uploads (SEC-FILE-01).
        $clientExt = strtolower($file->getClientOriginalExtension());
        if (in_array($clientExt, ['svg', 'svgz', 'html', 'htm', 'php', 'phtml', 'js', 'sh', 'exe'], true)) {
            throw ValidationException::withMessages([$field => [$errorMessage]]);
        }

        $head = (string) file_get_contents($realPath, false, null, 0, 2048);
        $this->assertNoDangerousScriptPayload($head, $field, $errorMessage);

        $finfo = new \finfo(FILEINFO_MIME_TYPE);
        $detectedMime = (string) $finfo->file($realPath);

        if (! array_key_exists($detectedMime, $allowedMimes)) {
            throw ValidationException::withMessages([$field => [$errorMessage]]);
        }

        return $detectedMime;
    }

    private function assertNoDangerousScriptPayload(string $bytes, string $field, string $errorMessage): void
    {
        $lower = strtolower($bytes);
        foreach (['<svg', '<!doctype html', '<html', '<script', '<?php'] as $marker) {
            if (str_contains($lower, $marker)) {
                throw ValidationException::withMessages([$field => [$errorMessage]]);
            }
        }
    }

    /**
     * Re-encode a JPEG or PNG image through GD to strip all EXIF/GPS metadata and resize to <= 1920px.
     */
    private function reencodeImage(
        UploadedFile $file,
        string $mime,
        string $field,
        string $errorMessage = 'Upload a JPG or PNG photo.',
    ): string {
        $realPath = $file->getRealPath();
        $imageInfo = @getimagesize($realPath);
        if ($imageInfo === false || $imageInfo[0] < 1 || $imageInfo[1] < 1) {
            throw ValidationException::withMessages([$field => [$errorMessage]]);
        }

        [$width, $height] = $imageInfo;

        $src = match ($mime) {
            'image/jpeg' => @imagecreatefromjpeg($realPath),
            'image/png' => @imagecreatefrompng($realPath),
            default => false,
        };

        if ($src === false) {
            throw ValidationException::withMessages([$field => [$errorMessage]]);
        }

        $targetWidth = $width;
        $targetHeight = $height;

        if ($width > self::MAX_DIMENSION || $height > self::MAX_DIMENSION) {
            if ($width >= $height) {
                $targetWidth = self::MAX_DIMENSION;
                $targetHeight = max(1, (int) round(($height / $width) * self::MAX_DIMENSION));
            } else {
                $targetHeight = self::MAX_DIMENSION;
                $targetWidth = max(1, (int) round(($width / $height) * self::MAX_DIMENSION));
            }
        }

        $dst = imagecreatetruecolor($targetWidth, $targetHeight);
        if ($mime === 'image/png') {
            imagealphablending($dst, false);
            imagesavealpha($dst, true);
            $transparent = imagecolorallocatealpha($dst, 0, 0, 0, 127);
            imagefilledrectangle($dst, 0, 0, $targetWidth, $targetHeight, $transparent);
        }

        imagecopyresampled($dst, $src, 0, 0, 0, 0, $targetWidth, $targetHeight, $width, $height);

        ob_start();
        if ($mime === 'image/jpeg') {
            imagejpeg($dst, null, 85);
        } else {
            imagepng($dst, null, 6);
        }
        $encoded = (string) ob_get_clean();

        imagedestroy($src);
        imagedestroy($dst);

        if ($encoded === '') {
            throw ValidationException::withMessages([$field => [$errorMessage]]);
        }

        return $encoded;
    }
}
