<?php

declare(strict_types=1);

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

class RepairImagesCommand extends Command
{
    protected $signature = 'pawfolio:repair-images {--source= : Original upload root containing public and private directories} {--fill-empty : Add illustrated defaults to empty covers and home avatars} {--write : Apply repairs; otherwise only report}';

    protected $description = 'Restore missing referenced images without overwriting uploads or fabricating personal verification documents';

    private array $known = [];

    private array $stats = ['restored' => 0, 'present' => 0, 'unrecoverable' => 0, 'defaults' => 0];

    private array $unrecoverable = [];

    public function handle(): int
    {
        $this->known = [];
        $this->stats = ['restored' => 0, 'present' => 0, 'unrecoverable' => 0, 'defaults' => 0];
        $this->unrecoverable = [];
        if (config('filesystems.disks.public.driver') !== 's3' || config('filesystems.disks.local.driver') !== 's3') {
            $this->error('Configure both Supabase upload disks before repairing deployed images.');

            return self::FAILURE;
        }

        try {
            foreach (['public', 'local'] as $disk) {
                $this->known[$disk] = array_fill_keys(Storage::disk($disk)->allFiles(), true);
            }

            $photos = DB::table('pet_photos')->join('pets', 'pets.id', '=', 'pet_photos.pet_id')
                ->select('pet_photos.file_path', 'pet_photos.sort_order', 'pet_photos.pet_id', 'pets.species')->get();
            foreach ($photos as $photo) {
                $sample = null;
                if (preg_match('/^pets\/photos\/demo-\d+-\d+(?:-(dog|cat)(\d+))?\.jpg$/', $photo->file_path, $match)) {
                    $kind = $photo->species === 'cat' ? 'cat' : 'dog';
                    $samples = glob(database_path("seeders/assets/pets/{$kind}-*.jpg")) ?: [];
                    natsort($samples);
                    $samples = array_values($samples);
                    $sample = isset($match[2])
                        ? database_path("seeders/assets/pets/{$kind}-{$match[2]}.jpg")
                        : ($samples ? $samples[($photo->pet_id + $photo->sort_order) % count($samples)] : null);
                }
                $this->restore('public', $photo->file_path, $sample);
            }

            foreach ([['pets', 'cover_photo_path', 'public'], ['home_profiles', 'profile_photo_path', 'public'], ['home_profiles', 'cover_photo_path', 'public'], ['post_photos', 'file_path', 'public'], ['verification_documents', 'file_path', 'local'], ['pet_vet_records', 'file_path', 'local']] as [$table, $column, $disk]) {
                foreach (DB::table($table)->whereNotNull($column)->where($column, '<>', '')->pluck($column)->unique() as $path) {
                    $this->restore($disk, $path);
                }
            }

            if ($this->option('fill-empty')) {
                $this->fillEmpty();
            }
        } catch (Throwable) {
            $this->error('Repair interrupted. Existing objects and references were preserved; check connectivity and rerun. Credentials were not logged.');

            return self::FAILURE;
        }

        $verb = $this->option('write') ? 'Repaired' : 'Would repair';
        $this->info("{$verb} {$this->stats['restored']} image(s); {$this->stats['present']} reference(s) already present; {$this->stats['defaults']} empty field(s) filled; {$this->stats['unrecoverable']} original file(s) unavailable.");
        if ($this->stats['unrecoverable']) {
            $this->warn('Unavailable original uploads need a backup or owner re-upload. Personal IDs and verification photos are never replaced with invented images.');
        }

        return self::SUCCESS;
    }

    private function restore(string $disk, string $path, ?string $sample = null): void
    {
        if (isset($this->known[$disk][$path])) {
            $this->stats['present']++;

            return;
        }

        $root = realpath(($this->option('source') ?: storage_path('app')).'/'.($disk === 'local' ? 'private' : 'public'));
        $original = $root ? realpath($root.'/'.$path) : false;
        // Only read within the selected source directory, including when paths contain symlinks.
        if ($original && ! str_starts_with(str_replace('\\', '/', $original), str_replace('\\', '/', $root).'/')) {
            $original = false;
        }
        $source = $original && is_file($original) ? $original : ($sample && is_file($sample) ? $sample : null);
        $contents = $source ? file_get_contents($source) : null;

        // These names are explicitly synthetic demo IDs, never personal uploaded documents.
        if ($contents === null && $disk === 'local' && preg_match('/^verification\/ids\/demo-user-\d+\.jpg$/', $path)) {
            $card = imagecreatetruecolor(640, 400);
            imagefill($card, 0, 0, imagecolorallocate($card, 243, 244, 246));
            $ink = imagecolorallocate($card, 31, 41, 55);
            imagestring($card, 5, 30, 40, 'SAMPLE ID - NOT A REAL DOCUMENT', $ink);
            imagestring($card, 5, 30, 150, 'Pawfolio demo account', $ink);
            imagestring($card, 5, 30, 210, 'ID: 0000-0000-0000', $ink);
            ob_start();
            imagejpeg($card, null, 85);
            $contents = ob_get_clean();
            imagedestroy($card);
        }

        if (! is_string($contents) || $contents === '') {
            if (! isset($this->unrecoverable[$disk.'/'.$path])) {
                $this->unrecoverable[$disk.'/'.$path] = true;
                $this->stats['unrecoverable']++;
            }

            return;
        }

        if ($this->option('write')) {
            // Recheck just before writing so a previously missing object is not replaced on a rerun.
            if (Storage::disk($disk)->exists($path)) {
                $this->known[$disk][$path] = true;
                $this->stats['present']++;

                return;
            }
            Storage::disk($disk)->put($path, $contents, ['ContentType' => (new \finfo(FILEINFO_MIME_TYPE))->buffer($contents)]);
            if ($disk === 'local') {
                DB::table('verification_documents')->where('file_path', $path)->update(['size_bytes' => strlen($contents)]);
            }
        }
        $this->known[$disk][$path] = true;
        $this->stats['restored']++;
    }

    private function fillEmpty(): void
    {
        $paths = [];
        foreach (['cover' => 'home-cover.png', 'avatar' => 'profile-avatar.png'] as $kind => $file) {
            $source = resource_path('images/defaults/'.$file);
            $path = 'defaults/'.pathinfo($file, PATHINFO_FILENAME).'-'.substr(hash_file('sha256', $source), 0, 16).'.png';
            if ($this->option('write') && ! Storage::disk('public')->exists($path)) {
                Storage::disk('public')->put($path, file_get_contents($source), ['ContentType' => 'image/png']);
            }
            $paths[$kind] = $path;
        }

        $changes = [];
        foreach ([['pets', 'cover_photo_path', $paths['cover']], ['home_profiles', 'cover_photo_path', $paths['cover']], ['home_profiles', 'profile_photo_path', $paths['avatar']]] as [$table, $column, $path]) {
            foreach (DB::table($table)->where(fn ($query) => $query->whereNull($column)->orWhere($column, ''))->select('id', $column)->get() as $row) {
                $changes[] = ['table' => $table, 'column' => $column, 'id' => $row->id, 'before' => $row->$column, 'after' => $path];
            }
        }
        if ($this->option('write') && $changes) {
            $backup = 'operations/image-repairs/'.Str::uuid().'.json';
            Storage::disk('local')->put($backup, json_encode($changes, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR), ['ContentType' => 'application/json']);
            $this->info('Original empty-field values backed up on the private disk: '.$backup);
            DB::transaction(function () use ($changes): void {
                foreach ($changes as $change) {
                    // A concurrent real upload wins; never replace a newly populated field.
                    $updated = DB::table($change['table'])->where('id', $change['id'])->where($change['column'], $change['before'])
                        ->update([$change['column'] => $change['after']]);
                    $this->stats['defaults'] += $updated;
                }
            });
        } else {
            $this->stats['defaults'] = count($changes);
        }
    }
}
