<?php

declare(strict_types=1);

namespace Tests\Feature\Uploads;

use GuzzleHttp\Exception\RequestException;
use GuzzleHttp\Promise\Create;
use GuzzleHttp\Psr7\Response;
use Illuminate\Support\Env;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use League\Flysystem\UnableToWriteFile;
use Tests\TestCase;

class SupabaseStorageTest extends TestCase
{
    private array $environment = [];

    private function cloudConfig(): array
    {
        $values = [
            'UPLOAD_STORAGE' => 'supabase',
            'SUPABASE_URL' => 'https://example.supabase.co',
            'SUPABASE_S3_ENDPOINT' => 'https://example.storage.supabase.co/storage/v1/s3',
            'SUPABASE_S3_REGION' => 'ap-southeast-1',
            'SUPABASE_S3_ACCESS_KEY_ID' => 'test-access',
            'SUPABASE_S3_SECRET_ACCESS_KEY' => 'test-secret',
            'SUPABASE_PUBLIC_BUCKET' => 'pawfolio-public',
            'SUPABASE_PRIVATE_BUCKET' => 'pawfolio-private',
        ];
        foreach ($values as $name => $value) {
            $this->environment[$name] = Env::getRepository()->get($name);
            Env::getRepository()->set($name, $value);
        }

        return require config_path('filesystems.php');
    }

    protected function tearDown(): void
    {
        foreach ($this->environment as $name => $value) {
            if ($value === null) {
                Env::getRepository()->clear($name);
            } else {
                Env::getRepository()->set($name, $value);
            }
        }
        parent::tearDown();
    }

    public function test_s3_writes_go_to_separate_buckets_and_public_urls_use_the_cdn(): void
    {
        $config = $this->cloudConfig();
        $requests = [];
        $handler = function ($request) use (&$requests) {
            $requests[] = $request;

            return Create::promiseFor(new Response(200, ['ETag' => '"test"'], ''));
        };
        $public = Storage::build([...$config['disks']['public'], 'http_handler' => $handler]);
        $private = Storage::build([...$config['disks']['local'], 'http_handler' => $handler]);
        $this->assertTrue($public->put('pets/photos/photo.jpg', 'photo'));
        $this->assertTrue($private->put('verification/document.pdf', '%PDF-document'));
        $this->assertStringContainsString('/pawfolio-public/pets/photos/photo.jpg', (string) $requests[0]->getUri());
        $this->assertStringContainsString('/pawfolio-private/verification/document.pdf', (string) $requests[1]->getUri());
        $this->assertSame('https://example.supabase.co/storage/v1/object/public/pawfolio-public/pets/photos/photo.jpg', $public->url('pets/photos/photo.jpg'));
        $this->assertArrayNotHasKey('url', $config['disks']['local']);
        $this->assertSame([], $config['links']);
    }

    public function test_failed_remote_writes_throw_instead_of_saving_a_missing_file_path(): void
    {
        $config = $this->cloudConfig();
        $disk = Storage::build([
            ...$config['disks']['public'],
            'retries' => 0,
            'http_handler' => fn ($request) => Create::rejectionFor(new RequestException(
                'Access denied', $request, new Response(403, [], '<Error><Code>AccessDenied</Code></Error>'),
            )),
        ]);
        $this->expectException(UnableToWriteFile::class);
        $disk->put('pets/photos/photo.jpg', 'photo');
    }

    public function test_a_private_download_uses_the_private_bucket_and_authenticated_s3_request(): void
    {
        $config = $this->cloudConfig();
        $requests = [];
        $disk = Storage::build([
            ...$config['disks']['local'],
            'http_handler' => function ($request) use (&$requests) {
                $requests[] = $request;

                return Create::promiseFor(new Response(200, ['Content-Type' => 'application/pdf'], '%PDF-private'));
            },
        ]);
        $this->assertSame('%PDF-private', $disk->get('verification/document.pdf'));
        $this->assertStringContainsString('/pawfolio-private/verification/document.pdf', (string) $requests[0]->getUri());
        $this->assertTrue($requests[0]->hasHeader('Authorization'));
    }

    public function test_cloud_mode_refuses_to_start_with_missing_credentials(): void
    {
        $this->cloudConfig();
        Env::getRepository()->set('SUPABASE_S3_SECRET_ACCESS_KEY', '');
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('SUPABASE_S3_SECRET_ACCESS_KEY is required');
        require config_path('filesystems.php');
    }

    public function test_private_files_cannot_be_configured_in_the_public_bucket(): void
    {
        $this->cloudConfig();
        Env::getRepository()->set('SUPABASE_PRIVATE_BUCKET', 'pawfolio-public');
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('two distinct bucket names');
        require config_path('filesystems.php');
    }

    public function test_transfer_dry_run_and_copy_preserve_sources_paths_and_existing_objects(): void
    {
        $root = storage_path('framework/testing/upload-transfer-'.uniqid());
        File::ensureDirectoryExists($root.'/public/pets/photos');
        File::ensureDirectoryExists($root.'/private/verification');
        File::put($root.'/public/pets/photos/photo.jpg', 'new photo');
        File::put($root.'/private/verification/document.pdf', '%PDF-private');
        config(['filesystems.disks.public.driver' => 's3', 'filesystems.disks.local.driver' => 's3']);
        Storage::fake('public');
        Storage::fake('local');
        Storage::disk('public')->put('pets/photos/photo.jpg', 'existing photo');
        try {
            $this->artisan('pawfolio:migrate-uploads', ['--source' => $root])
                ->expectsOutput('Would copy 1 file(s); skipped 1 existing object(s). Source files were retained.')->assertSuccessful();
            Storage::disk('local')->assertMissing('verification/document.pdf');
            $this->artisan('pawfolio:migrate-uploads', ['--source' => $root, '--write' => true])->assertSuccessful();
            $this->assertSame('%PDF-private', Storage::disk('local')->get('verification/document.pdf'));
            $this->assertSame('existing photo', Storage::disk('public')->get('pets/photos/photo.jpg'));
            $this->assertFileExists($root.'/private/verification/document.pdf');
        } finally {
            File::deleteDirectory($root);
        }
    }
}
