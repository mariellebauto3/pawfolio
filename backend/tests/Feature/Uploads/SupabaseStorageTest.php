<?php

declare(strict_types=1);

namespace Tests\Feature\Uploads;

use App\Models\Pet;
use App\Models\User;
use Aws\Command;
use Aws\S3\Exception\S3Exception;
use GuzzleHttp\Exception\RequestException;
use GuzzleHttp\Promise\Create;
use GuzzleHttp\Psr7\Response;
use Illuminate\Contracts\Debug\ExceptionHandler;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Env;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use League\Flysystem\UnableToWriteFile;
use Tests\TestCase;

class SupabaseStorageTest extends TestCase
{
    use RefreshDatabase;

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

    public function test_pet_photo_endpoint_processes_a_real_jpeg_and_saves_the_cloud_photo(): void
    {
        $settings = $this->cloudConfig();
        $requests = [];
        $settings['disks']['public']['http_handler'] = function ($request) use (&$requests) {
            $requests[] = $request;

            return Create::promiseFor(new Response(200, ['ETag' => '"photo"'], ''));
        };
        config(['filesystems' => $settings]);
        Storage::forgetDisk(['public', 'local']);
        $user = User::factory()->pet()->active()->create();
        $pet = Pet::factory()->for($user)->draft()->create();

        $response = $this->actingAs($user)->postJson('/api/v1/me/pet/photos', [
            'photo' => UploadedFile::fake()->image('test.jpg', 800, 600),
            'is_primary' => true,
        ])->assertCreated();

        $photo = $pet->photos()->sole();
        $this->assertSame(1, $photo->sort_order);
        $this->assertCount(1, $requests);
        $this->assertSame('PUT', $requests[0]->getMethod());
        $this->assertTrue($requests[0]->hasHeader('Authorization'));
        $this->assertStringContainsString('/pawfolio-public/'.$photo->file_path, (string) $requests[0]->getUri());
        $this->assertNotFalse(getimagesizefromstring((string) $requests[0]->getBody()));
        $response->assertJsonPath('data.photos.0.url', 'https://example.supabase.co/storage/v1/object/public/pawfolio-public/'.$photo->file_path);
    }

    public function test_a_rejected_cloud_upload_does_not_save_a_photo_and_logs_safe_provider_details(): void
    {
        $settings = $this->cloudConfig();
        $settings['disks']['public']['retries'] = 0;
        $settings['disks']['public']['http_handler'] = fn ($request) => Create::rejectionFor(new RequestException(
            'Do not log this raw provider message', $request, new Response(403, [], '<Error><Code>AccessDenied</Code></Error>'),
        ));
        config(['filesystems' => $settings]);
        Storage::forgetDisk(['public', 'local']);
        $user = User::factory()->pet()->active()->create();
        $pet = Pet::factory()->for($user)->draft()->create();

        $this->actingAs($user)->postJson('/api/v1/me/pet/photos', [
            'photo' => UploadedFile::fake()->image('test.jpg', 300, 300),
        ])->assertStatus(500)->assertJsonPath('code', 'server');
        $this->assertSame(0, $pet->photos()->count());
        // Exercise error rendering directly so the framework's report logger does
        // not interfere with a Log facade spy before the original error is rendered.
        Log::spy();
        $provider = new S3Exception('Do not log this raw provider message', new Command('PutObject'), [
            'code' => 'AccessDenied',
            'response' => new Response(403),
        ]);
        app(ExceptionHandler::class)->render(
            Request::create('/api/v1/me/pet/photos', 'POST'),
            UnableToWriteFile::atLocation('pets/photos/test.jpg', 'Do not log this raw provider message', $provider),
        );
        Log::shouldHaveReceived('error')->withArgs(function ($message, $context) {
            return $message === 'Unhandled API exception'
                && $context['storage_failure'] === ['status' => 403, 'code' => 'AccessDenied', 'operation' => 'PutObject']
                && ! str_contains(json_encode($context), 'test-secret')
                && ! str_contains(json_encode($context), 'Do not log this raw provider message');
        });
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
