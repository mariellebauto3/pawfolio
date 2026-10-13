<?php

declare(strict_types=1);

namespace Tests\Feature\Analytics;

use App\Models\User;
use App\Services\Analytics\PlatformDashboard;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class DashboardMetricsCacheTest extends TestCase
{
    use DatabaseMigrations;

    protected function setUp(): void
    {
        parent::setUp();
        config(['performance.dashboard_cache_store' => 'array']);
        Cache::store('array')->flush();
        $this->freezeTime();
    }

    public function test_cache_hits_replace_aggregate_queries_with_one_revision_check(): void
    {
        User::factory()->pet()->active()->create();
        $dashboard = app(PlatformDashboard::class);
        $first = $dashboard->metrics();
        DB::enableQueryLog();
        DB::flushQueryLog();
        try {
            $this->assertSame($first, $dashboard->metrics());
            $this->assertCount(1, DB::getQueryLog());
        } finally {
            DB::disableQueryLog();
        }
        $this->assertSame(['tiles', 'trends'], array_keys($first));
    }

    public function test_bulk_changes_invalidate_and_transactions_never_publish_uncommitted_metrics(): void
    {
        $user = User::factory()->pet()->active()->create();
        $dashboard = app(PlatformDashboard::class);
        $this->assertSame(1, $dashboard->metrics()['tiles']['accounts']['active']);
        User::whereKey($user->id)->update(['status' => 'suspended']);
        $this->assertSame(0, $dashboard->metrics()['tiles']['accounts']['active']);
        DB::beginTransaction();
        try {
            User::whereKey($user->id)->update(['status' => 'active']);
            $this->assertSame(1, $dashboard->metrics()['tiles']['accounts']['active']);
        } finally {
            DB::rollBack();
        }
        $this->assertSame(0, $dashboard->metrics()['tiles']['accounts']['active']);
    }

    public function test_clock_bucket_expiry_reloads_and_cached_metrics_do_not_bypass_role_checks(): void
    {
        $dashboard = app(PlatformDashboard::class);
        $dashboard->metrics();
        $this->travel(16)->seconds();
        DB::enableQueryLog();
        DB::flushQueryLog();
        try {
            $dashboard->metrics();
            $this->assertGreaterThan(1, count(DB::getQueryLog()));
        } finally {
            DB::disableQueryLog();
        }
        $this->actingAs(User::factory()->human()->active()->create())->getJson('/api/v1/admin/dashboard')->assertForbidden();
        $this->actingAs(User::factory()->admin()->suspended()->create())->getJson('/api/v1/admin/dashboard')->assertForbidden();
    }

    public function test_cache_outage_falls_back_to_live_aggregates(): void
    {
        User::factory()->human()->active()->create();
        Cache::shouldReceive('store')->once()->with('array')->andThrow(new \RuntimeException('Cache unavailable'));
        $this->assertSame(1, app(PlatformDashboard::class)->metrics()['tiles']['accounts']['active']);
    }
}
