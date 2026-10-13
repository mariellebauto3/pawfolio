<?php

namespace Tests\Feature\Discovery;

use App\Enums\PetStatus;
use App\Models\Adoption;
use App\Models\HomeProfile;
use App\Models\Pet;
use App\Models\User;
use App\Services\Discovery\RecentlyHired;
use Illuminate\Contracts\Cache\Repository;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Predis\Client;
use Tests\TestCase;

class RecentlyHiredCacheTest extends TestCase
{
    use DatabaseMigrations;

    protected function setUp(): void
    {
        parent::setUp();
        config(['performance.read_cache_store' => 'array']);
        Cache::store('array')->flush();
        Storage::fake('public');
    }

    private function hired(string $name): Pet
    {
        $pet = Pet::factory()->for(User::factory()->pet()->active())->create(['name' => $name, 'status' => PetStatus::AdoptedHired]);
        Adoption::factory()->create([
            'pet_id' => $pet->id,
            'home_profile_id' => HomeProfile::factory()->create()->id,
            'adopted_at' => now(),
        ]);

        return $pet;
    }

    private function read(): array
    {
        return app(RecentlyHired::class)->items();
    }

    public function test_hit_replaces_three_business_queries_with_one_revision_query(): void
    {
        $this->hired('Luna');
        DB::enableQueryLog();
        DB::flushQueryLog();
        $first = $this->read();
        $this->assertCount(4, DB::getQueryLog());
        DB::flushQueryLog();
        $this->assertSame($first, $this->read());
        $this->assertCount(1, DB::getQueryLog());
        DB::disableQueryLog();
    }

    public function test_bulk_writes_and_new_hires_invalidate_without_redis_deletes(): void
    {
        $pet = $this->hired('Luna');
        $this->assertSame('Luna', $this->read()[0]['name']);
        Pet::whereKey($pet->id)->update(['name' => 'Kimchi']);
        $this->assertSame('Kimchi', $this->read()[0]['name']);
        $new = $this->hired('New hire');
        $this->assertSame('New hire', $this->read()[0]['name']);
        User::whereKey($new->user_id)->update(['status' => 'suspended']);
        $this->assertCount(1, $this->read());
        Adoption::where('pet_id', $pet->id)->update(['link_removed_at' => now()]);
        $this->assertSame([], $this->read());
    }

    public function test_rollback_does_not_publish_uncommitted_data_to_shared_cache(): void
    {
        $pet = $this->hired('Luna');
        $original = $this->read();
        $revision = DB::table('read_cache_versions')->value('version');
        DB::beginTransaction();
        try {
            Pet::whereKey($pet->id)->update(['name' => 'Uncommitted']);
            $this->assertSame('Uncommitted', $this->read()[0]['name']);
        } finally {
            DB::rollBack();
        }
        $this->assertSame($revision, DB::table('read_cache_versions')->value('version'));
        $this->assertSame($original, $this->read());
    }

    public function test_cached_photos_still_check_files_and_photo_changes_invalidate(): void
    {
        $pet = $this->hired('Luna');
        $this->assertNull($this->read()[0]['photo_url']);
        $pet->photos()->create(['file_path' => 'luna.jpg', 'sort_order' => 1]);
        Storage::disk('public')->put('luna.jpg', 'photo');
        $this->assertSame(Storage::disk('public')->url('luna.jpg'), $this->read()[0]['photo_url']);
        Storage::disk('public')->delete('luna.jpg');
        $this->assertNull($this->read()[0]['photo_url']);
    }

    public function test_cache_connection_failure_falls_back_to_database(): void
    {
        $this->hired('Luna');
        Cache::shouldReceive('store')->once()->with('array')->andThrow(new \RuntimeException('unavailable'));
        $this->assertSame('Luna', $this->read()[0]['name']);
    }

    public function test_cache_write_failure_does_not_discard_successful_database_read(): void
    {
        $this->hired('Luna');
        $repository = \Mockery::mock(Repository::class);
        $repository->shouldReceive('get')->once()->andReturn(null);
        $repository->shouldReceive('put')->once()->andThrow(new \RuntimeException('unavailable'));
        Cache::shouldReceive('store')->once()->with('array')->andReturn($repository);
        $this->assertSame('Luna', $this->read()[0]['name']);
    }

    public function test_real_predis_connection_failure_preserves_public_response(): void
    {
        $this->hired('Luna');
        config([
            'performance.read_cache_store' => 'redis',
            'database.redis.client' => 'predis',
            'database.redis.cache.url' => null,
            'database.redis.cache.host' => '127.0.0.1',
            'database.redis.cache.port' => 1,
            'database.redis.cache.username' => null,
            'database.redis.cache.password' => null,
            'database.redis.cache.timeout' => 0.05,
        ]);
        $this->assertTrue(class_exists(Client::class));
        $this->getJson('/api/v1/public/recently-hired')->assertOk()->assertJsonPath('data.0.name', 'Luna');
    }
}
