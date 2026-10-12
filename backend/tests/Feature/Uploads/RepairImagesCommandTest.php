<?php

namespace Tests\Feature\Uploads;

use App\Models\HomeProfile;
use App\Models\Pet;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class RepairImagesCommandTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
        Storage::fake('local');
        config(['filesystems.disks.public.driver' => 's3', 'filesystems.disks.local.driver' => 's3']);
    }

    public function test_dry_run_leaves_storage_and_profile_fields_unchanged(): void
    {
        $pet = Pet::factory()->create(['cover_photo_path' => null]);
        $pet->photos()->create(['file_path' => "pets/photos/demo-{$pet->id}-1-dog4.jpg", 'sort_order' => 1]);

        $this->artisan('pawfolio:repair-images', ['--fill-empty' => true])->assertSuccessful();

        $this->assertNull($pet->fresh()->cover_photo_path);
        $this->assertSame([], Storage::disk('public')->allFiles());
        $this->assertSame([], Storage::disk('local')->allFiles());
    }

    public function test_repairs_demo_photos_and_empty_fields_once_without_replacing_uploads(): void
    {
        $pet = Pet::factory()->create(['species' => 'dog', 'cover_photo_path' => null]);
        $sample = "pets/photos/demo-{$pet->id}-1-dog4.jpg";
        $pet->photos()->create(['file_path' => $sample, 'sort_order' => 1]);
        $pet->photos()->create(['file_path' => 'pets/photos/real-photo.jpg', 'sort_order' => 2]);
        Storage::disk('public')->put('pets/photos/real-photo.jpg', 'existing uploaded bytes');
        $home = HomeProfile::factory()->create(['cover_photo_path' => null, 'profile_photo_path' => null]);
        $custom = HomeProfile::factory()->create(['cover_photo_path' => 'homes/custom-cover.jpg', 'profile_photo_path' => 'homes/custom-avatar.jpg']);
        Storage::disk('public')->put('homes/custom-cover.jpg', 'custom cover');
        Storage::disk('public')->put('homes/custom-avatar.jpg', 'custom avatar');

        $options = ['--fill-empty' => true, '--write' => true];
        $this->artisan('pawfolio:repair-images', $options)->assertSuccessful();

        $this->assertSame(file_get_contents(database_path('seeders/assets/pets/dog-4.jpg')), Storage::disk('public')->get($sample));
        $this->assertSame('existing uploaded bytes', Storage::disk('public')->get('pets/photos/real-photo.jpg'));
        Storage::disk('public')->assertExists($pet->fresh()->cover_photo_path);
        Storage::disk('public')->assertExists($home->fresh()->profile_photo_path);
        Storage::disk('public')->assertExists($home->fresh()->cover_photo_path);
        $this->assertSame('homes/custom-avatar.jpg', $custom->fresh()->profile_photo_path);
        $this->assertSame('homes/custom-cover.jpg', $custom->fresh()->cover_photo_path);
        $backups = Storage::disk('local')->allFiles('operations/image-repairs');
        $this->assertCount(1, $backups);
        $this->assertCount(3, json_decode(Storage::disk('local')->get($backups[0]), true));
        $files = Storage::disk('public')->allFiles();

        $this->artisan('pawfolio:repair-images', $options)->assertSuccessful();
        $this->assertSame($files, Storage::disk('public')->allFiles());
        $this->assertSame($backups, Storage::disk('local')->allFiles('operations/image-repairs'));
    }

    public function test_a_missing_real_verification_document_is_never_fabricated(): void
    {
        $pet = Pet::factory()->create();
        $submission = DB::table('verification_submissions')->insertGetId([
            'user_id' => $pet->user_id, 'status' => 'pending', 'created_at' => now(), 'updated_at' => now(),
        ]);
        DB::table('verification_documents')->insert([
            'verification_submission_id' => $submission, 'document_type' => 'valid_id',
            'file_path' => 'verification/ids/missing-personal-id.png', 'mime_type' => 'image/png', 'size_bytes' => 123,
            'created_at' => now(), 'updated_at' => now(),
        ]);

        $this->artisan('pawfolio:repair-images', ['--write' => true])
            ->expectsOutputToContain('1 original file(s) unavailable')->assertSuccessful();

        Storage::disk('local')->assertMissing('verification/ids/missing-personal-id.png');
        $this->assertDatabaseHas('verification_documents', ['file_path' => 'verification/ids/missing-personal-id.png', 'size_bytes' => 123]);
    }
}
