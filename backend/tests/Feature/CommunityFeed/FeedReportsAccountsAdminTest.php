<?php

declare(strict_types=1);

namespace Tests\Feature\CommunityFeed;

use App\Enums\AccountStatus;
use App\Enums\ReportStatus;
use App\Models\ActivityLog;
use App\Models\HomeProfile;
use App\Models\Pet;
use App\Models\Report;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use LogicException;
use Tests\TestCase;

class FeedReportsAccountsAdminTest extends TestCase
{
    use RefreshDatabase;

    public function test_community_feed_auto_flags_selling_keywords_and_enforces_single_level_comment_replies(): void
    {
        $petUser = User::factory()->pet()->active()->create(['name' => 'Mochi']);
        Pet::factory()->for($petUser)->lookingForAHome()->create(['name' => 'Mochi']);

        $humanUser = User::factory()->human()->active()->create(['name' => 'Ana Santos']);
        HomeProfile::factory()->for($humanUser)->openToAdopt()->create(['full_name' => 'Ana Santos']);

        // Posting a body containing a payment keyword ("GCash") automatically creates a Report (SEC-ABUSE-04).
        $postRes = $this->actingAs($petUser)->postJson('/api/v1/posts', [
            'body' => 'Asking for a small rehoming fee via GCash to cover food.',
        ])->assertCreated();

        $postId = $postRes->json('data.id');
        $this->assertTrue(
            Report::query()
                ->where('post_id', $postId)
                ->where('reason', 'selling_or_trading_animals')
                ->where('status', ReportStatus::Open->value)
                ->exists(),
        );

        // Top-level comment + 1-level reply work; reply-to-reply is rejected with 422.
        $topCommentId = $this->actingAs($humanUser)->postJson("/api/v1/posts/{$postId}/comments", [
            'body' => 'Adoption on Pawfolio must be free!',
        ])->assertCreated()
            ->json('data.id');

        $replyId = $this->actingAs($petUser)->postJson("/api/v1/posts/{$postId}/comments", [
            'body' => 'Understood, thank you.',
            'parent_comment_id' => $topCommentId,
        ])->assertCreated()
            ->json('data.id');

        $this->actingAs($humanUser)->postJson("/api/v1/posts/{$postId}/comments", [
            'body' => 'Nested deeper reply',
            'parent_comment_id' => $replyId,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['parent_comment_id']);

        // Admin reviews the report and removes the post.
        $admin = User::factory()->admin()->active()->create();
        $report = Report::query()->where('post_id', $postId)->firstOrFail();

        $this->actingAs($admin)->postJson("/api/v1/admin/reports/{$report->id}/actions", [
            'action' => 'remove_content',
            'reason' => 'Rehoming fees are prohibited on Pawfolio.',
        ])->assertOk()
            ->assertJsonPath('data.status', 'resolved');
    }

    public function test_announcements_analytics_accounts_and_append_only_activity_logs(): void
    {
        $admin = User::factory()->admin()->active()->create(['name' => 'admin.jess']);
        $petUser = User::factory()->pet()->active()->create(['name' => 'Mochi']);
        Pet::factory()->for($petUser)->lookingForAHome()->create(['name' => 'Mochi']);

        $humanUser = User::factory()->human()->active()->create(['name' => 'Ana Santos']);
        HomeProfile::factory()->for($humanUser)->openToAdopt()->create(['full_name' => 'Ana Santos']);

        // Admin publishes an immediate announcement to everyone (BE-24).
        $this->actingAs($admin)->postJson('/api/v1/admin/announcements', [
            'title' => 'Platform Maintenance Notice',
            'message' => 'Scheduled maintenance this Sunday at 2 AM.',
            'audience' => 'everyone',
        ])->assertCreated()
            ->assertJsonPath('data.status', 'published');

        // Member stats (BE-25) work for both Pet and Human; Admin dashboard works for Admin.
        $this->actingAs($petUser)->getJson('/api/v1/stats')
            ->assertOk()
            ->assertJsonPath('data.role', 'pet');

        $this->actingAs($humanUser)->getJson('/api/v1/stats')
            ->assertOk()
            ->assertJsonPath('data.role', 'human');

        $this->actingAs($admin)->getJson('/api/v1/admin/dashboard')
            ->assertOk()
            ->assertJsonStructure([
                'data' => [
                    'tiles' => ['accounts', 'verification_queue_count', 'open_reports_count', 'pets_by_status', 'requests'],
                    'needs_attention' => ['pending_verifications', 'open_reports', 'overdue_requests'],
                ],
            ]);

        // Admin suspends and reactivates an account (BE-23).
        $this->actingAs($admin)->postJson("/api/v1/admin/accounts/{$petUser->id}/suspend", [
            'reason' => 'Policy violation under review.',
        ])->assertOk()
            ->assertJsonPath('data.status', 'suspended');

        $this->assertSame(AccountStatus::Suspended, $petUser->fresh()->getStatus());

        $this->actingAs($admin)->postJson("/api/v1/admin/accounts/{$petUser->id}/reactivate", [
            'reason' => 'Appeal resolved.',
        ])->assertOk()
            ->assertJsonPath('data.status', 'active');

        // Activity logs & CSV export (BE-26).
        $this->actingAs($admin)->getJson('/api/v1/admin/activity-logs')
            ->assertOk();

        $this->actingAs($admin)->get('/api/v1/admin/activity-logs/export')
            ->assertOk()
            ->assertHeader('Content-Type', 'text/csv; charset=UTF-8');

        // SEC-LOG-02: ActivityLog is strictly append-only at the model layer.
        $log = ActivityLog::query()->firstOrFail();
        $this->expectException(LogicException::class);
        $log->delete();
    }
}
