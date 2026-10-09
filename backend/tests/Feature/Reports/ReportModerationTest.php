<?php

declare(strict_types=1);

namespace Tests\Feature\Reports;

use App\Enums\AccountStatus;
use App\Models\Comment;
use App\Models\HomeProfile;
use App\Models\Pet;
use App\Models\Post;
use App\Models\Report;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Reports & Moderation as the screens use it (BE-22, FE-21, RP-01…RP-05): who may file and read a report, the
 * queue's one row per reported item, and each action an admin can take on it.
 */
class ReportModerationTest extends TestCase
{
    use RefreshDatabase;

    private User $ana;

    private User $mochi;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->ana = User::factory()->human()->active()->create(['name' => 'Ana Santos']);
        HomeProfile::factory()->for($this->ana)->openToAdopt()->create(['full_name' => 'Ana Santos']);
        $this->mochi = User::factory()->pet()->active()->create(['name' => 'Mochi']);
        Pet::factory()->for($this->mochi)->lookingForAHome()->create(['name' => 'Mochi']);
        $this->admin = User::factory()->admin()->active()->create(['name' => 'admin.jess']);
    }

    /** One more Active human, to report with. */
    private function reporter(string $name): User
    {
        $user = User::factory()->human()->active()->create(['name' => $name]);
        HomeProfile::factory()->for($user)->create(['full_name' => $name]);

        return $user;
    }

    private function reportPost(User $reporter, Post $post, string $reason = 'spam_or_scam'): int
    {
        return (int) $this->actingAs($reporter)
            ->postJson('/api/v1/reports', ['target_type' => 'post', 'post_id' => $post->id, 'reason' => $reason])
            ->assertCreated()
            ->json('data.id');
    }

    public function test_only_a_signed_in_active_account_files_a_report_and_only_an_admin_reads_the_queue(): void
    {
        $post = Post::factory()->for($this->mochi, 'author')->create();
        $payload = ['target_type' => 'post', 'post_id' => $post->id, 'reason' => 'spam_or_scam'];

        $this->postJson('/api/v1/reports', $payload)->assertUnauthorized();

        $suspended = User::factory()->human()->suspended()->create();
        $this->actingAs($suspended)->postJson('/api/v1/reports', $payload)
            ->assertForbidden()
            ->assertJsonPath('code', 'account_not_active');

        $reportId = $this->reportPost($this->ana, $post);

        foreach (['/api/v1/admin/reports', "/api/v1/admin/reports/{$reportId}"] as $path) {
            $this->actingAs($this->ana)->getJson($path)->assertForbidden();
        }
        $this->actingAs($this->ana)
            ->postJson("/api/v1/admin/reports/{$reportId}/actions", ['action' => 'dismiss', 'reason' => 'Mine to dismiss.'])
            ->assertForbidden();
        $this->assertDatabaseHas('reports', ['id' => $reportId, 'status' => 'open']);
    }

    public function test_a_report_needs_a_known_target_and_reason_and_never_names_an_admin(): void
    {
        $this->actingAs($this->ana)->postJson('/api/v1/reports', ['target_type' => 'story', 'reason' => 'because'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['target_type', 'reason']);

        // "Something else" names no problem by itself, so it needs the details.
        $this->actingAs($this->ana)
            ->postJson('/api/v1/reports', ['target_type' => 'account', 'target_id' => $this->mochi->id, 'reason' => 'something_else', 'details' => '  '])
            ->assertUnprocessable()
            ->assertJsonPath('errors.details.0', 'Tell us what is wrong, so an admin knows what to look for.');

        $this->actingAs($this->ana)
            ->postJson('/api/v1/reports', ['target_type' => 'post', 'post_id' => 999, 'reason' => 'spam_or_scam'])
            ->assertNotFound();

        $this->actingAs($this->ana)
            ->postJson('/api/v1/reports', ['target_type' => 'account', 'target_id' => $this->admin->id, 'reason' => 'spam_or_scam'])
            ->assertNotFound();

        // A profile is reported by the pet's or the Home Profile's own id, and filed against the account behind it.
        $this->actingAs($this->ana)
            ->postJson('/api/v1/reports', [
                'target_type' => 'profile',
                'pet_id' => $this->mochi->pet->id,
                'reason' => 'fake_or_misleading_profile',
                'details' => '  The photos are from a stock site.  ',
            ])
            ->assertCreated();
        $this->assertDatabaseHas('reports', [
            'reporter_user_id' => $this->ana->id,
            'reported_user_id' => $this->mochi->id,
            'target_type' => 'profile',
            'details' => 'The photos are from a stock site.',
        ]);
    }

    public function test_the_same_item_is_reported_once_per_account_until_it_is_resolved(): void
    {
        $post = Post::factory()->for($this->mochi, 'author')->create();
        $reportId = $this->reportPost($this->ana, $post);

        $this->actingAs($this->ana)
            ->postJson('/api/v1/reports', ['target_type' => 'post', 'post_id' => $post->id, 'reason' => 'harassment_or_hate'])
            ->assertConflict()
            ->assertJsonPath('code', 'report_already_open');
        $this->assertDatabaseCount('reports', 1);

        // Another account can still report it, and so can the first one about something else of the same author.
        $this->reportPost($this->reporter('Paolo Garcia'), $post);
        $this->actingAs($this->ana)
            ->postJson('/api/v1/reports', ['target_type' => 'account', 'target_id' => $this->mochi->id, 'reason' => 'spam_or_scam'])
            ->assertCreated();

        $this->actingAs($this->admin)
            ->postJson("/api/v1/admin/reports/{$reportId}/actions", ['action' => 'dismiss', 'reason' => 'No violation found.'])
            ->assertOk();
        $this->reportPost($this->ana, $post);
    }

    public function test_the_queue_lists_one_row_per_reported_item_most_reported_first(): void
    {
        $quiet = Post::factory()->for($this->mochi, 'author')->create(['body' => 'One report.']);
        $loud = Post::factory()->for($this->mochi, 'author')->create(['body' => 'Three reports.']);

        $this->reportPost($this->ana, $loud);
        $this->reportPost($this->ana, $quiet);
        $this->reportPost($this->reporter('Paolo Garcia'), $loud);
        $latest = $this->reportPost($this->reporter('Marco Reyes'), $loud, 'selling_or_trading_animals');

        $this->actingAs($this->admin)->getJson('/api/v1/admin/reports')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('meta.total', 2)
            // The item's latest report stands for the row.
            ->assertJsonPath('data.0.id', $latest)
            ->assertJsonPath('data.0.post_id', $loud->id)
            ->assertJsonPath('data.0.reports_count', 3)
            ->assertJsonPath('data.0.reason', 'selling_or_trading_animals')
            ->assertJsonPath('data.0.reporter.display_name', 'Marco Reyes')
            ->assertJsonPath('data.0.reported_user.display_name', 'Mochi')
            ->assertJsonPath('data.1.post_id', $quiet->id)
            ->assertJsonPath('data.1.reports_count', 1);

        $this->actingAs($this->admin)->getJson('/api/v1/admin/reports?status=resolved')
            ->assertOk()
            ->assertJsonCount(0, 'data');

        // A filter the API doesn't know is refused, not passed on (SEC-INPUT-03).
        $this->actingAs($this->admin)->getJson('/api/v1/admin/reports?status=everything')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['status']);
    }

    public function test_the_review_shows_the_content_every_report_on_it_and_the_reported_account(): void
    {
        $post = Post::factory()->for($this->mochi, 'author')->create(['title' => 'Puppies', 'body' => 'Puppies available, message me.']);
        $this->reportPost($this->ana, $post);
        $reportId = $this->reportPost($this->reporter('Paolo Garcia'), $post, 'selling_or_trading_animals');

        $this->actingAs($this->admin)->getJson("/api/v1/admin/reports/{$reportId}")
            ->assertOk()
            ->assertJsonPath('data.status', 'open')
            ->assertJsonPath('data.reports_count', 2)
            ->assertJsonCount(2, 'data.sibling_reports')
            ->assertJsonPath('data.sibling_reports.0.reporter_name', 'Paolo Garcia')
            ->assertJsonPath('data.content_preview.post.body', 'Puppies available, message me.')
            ->assertJsonPath('data.content_preview.post.photos', [])
            ->assertJsonPath('data.content_preview.post.is_removed', false)
            ->assertJsonPath('data.content_preview.comment', null)
            ->assertJsonPath('data.reported_user.id', $this->mochi->id)
            ->assertJsonPath('data.reported_user.status', 'active')
            ->assertJsonPath('data.reported_user.profile_id', $this->mochi->pet->id)
            ->assertJsonPath('data.reported_user.reports_against_count', 2)
            ->assertJsonPath('data.report_action', null);

        $this->actingAs($this->admin)->getJson('/api/v1/admin/reports/999')->assertNotFound();
    }

    public function test_removing_content_needs_a_reason_resolves_every_open_report_and_is_done_once(): void
    {
        $post = Post::factory()->for($this->mochi, 'author')->create();
        $first = $this->reportPost($this->ana, $post);
        $second = $this->reportPost($this->reporter('Paolo Garcia'), $post);

        $this->actingAs($this->admin)
            ->postJson("/api/v1/admin/reports/{$first}/actions", ['action' => 'remove_content'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['reason']);
        $this->actingAs($this->admin)
            ->postJson("/api/v1/admin/reports/{$first}/actions", ['action' => 'delete_everything', 'reason' => 'Because.'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['action']);

        $this->actingAs($this->admin)
            ->postJson("/api/v1/admin/reports/{$first}/actions", ['action' => 'remove_content', 'reason' => 'Selling animals is not allowed on Pawfolio.'])
            ->assertOk()
            ->assertJsonPath('data.status', 'resolved')
            ->assertJsonPath('data.report_action.action', 'remove_content')
            ->assertJsonPath('data.report_action.performed_by', 'admin.jess')
            ->assertJsonPath('data.content_preview.post.is_removed', true);

        $this->assertDatabaseHas('reports', ['id' => $second, 'status' => 'resolved']);
        $this->assertDatabaseCount('report_actions', 1);
        $this->assertDatabaseHas('activity_logs', ['action' => 'report_resolved_remove_content', 'actor_user_id' => $this->admin->id]);

        // The post is gone from the feed and from its own address, and its author and both reporters are told.
        $this->actingAs($this->ana)->getJson("/api/v1/posts/{$post->id}")->assertNotFound();
        $this->assertDatabaseHas('notifications', ['user_id' => $this->mochi->id, 'title' => 'Moderation update on your account']);
        $this->assertSame(2, DB::table('notifications')->where('title', 'Update on your report')->count());

        // A second admin, a moment later: told that it is resolved, and nothing is done twice.
        $this->actingAs($this->admin)
            ->postJson("/api/v1/admin/reports/{$second}/actions", ['action' => 'dismiss', 'reason' => 'Looked fine to me.'])
            ->assertConflict()
            ->assertJsonPath('code', 'report_already_resolved');
        $this->assertDatabaseCount('report_actions', 1);

        // Only the resolved tab lists it now, as one row.
        $this->actingAs($this->admin)->getJson('/api/v1/admin/reports')->assertJsonCount(0, 'data');
        $this->actingAs($this->admin)->getJson('/api/v1/admin/reports?status=resolved')
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.reports_count', 2)
            ->assertJsonPath('data.0.report_action.action', 'remove_content');
    }

    public function test_removed_content_is_restored_from_a_resolved_report_and_only_then(): void
    {
        $post = Post::factory()->for($this->mochi, 'author')->create();
        $comment = Comment::factory()->for($post)->for($this->mochi, 'author')->create();
        $reportId = (int) $this->actingAs($this->ana)
            ->postJson('/api/v1/reports', ['target_type' => 'comment', 'comment_id' => $comment->id, 'reason' => 'harassment_or_hate'])
            ->assertCreated()
            ->json('data.id');
        $actions = "/api/v1/admin/reports/{$reportId}/actions";

        $this->actingAs($this->admin)->postJson($actions, ['action' => 'restore_content', 'reason' => 'Nothing was removed.'])
            ->assertConflict()
            ->assertJsonPath('code', 'nothing_to_restore');

        $this->actingAs($this->admin)->postJson($actions, ['action' => 'remove_content', 'reason' => 'Insulting another member.'])
            ->assertOk()
            ->assertJsonPath('data.content_preview.comment.is_removed', true)
            // A report on a comment removes the comment, never the post it is under.
            ->assertJsonPath('data.content_preview.post.is_removed', false);

        $this->actingAs($this->admin)->postJson($actions, ['action' => 'restore_content'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['reason']);

        $this->actingAs($this->admin)->postJson($actions, ['action' => 'restore_content', 'reason' => 'Removed by mistake.'])
            ->assertOk()
            ->assertJsonPath('data.status', 'resolved')
            ->assertJsonPath('data.content_preview.comment.is_removed', false);

        $this->assertNull($comment->fresh()->removed_at);
        $this->assertDatabaseHas('activity_logs', ['action' => 'reported_content_restored', 'reason' => 'Removed by mistake.']);
    }

    public function test_a_reported_profile_has_nothing_to_remove_and_suspending_ends_the_accounts_sessions(): void
    {
        $reportId = (int) $this->actingAs($this->ana)
            ->postJson('/api/v1/reports', ['target_type' => 'profile', 'pet_id' => $this->mochi->pet->id, 'reason' => 'fake_or_misleading_profile'])
            ->assertCreated()
            ->json('data.id');
        $actions = "/api/v1/admin/reports/{$reportId}/actions";

        foreach (['remove_content', 'remove_content_and_suspend'] as $action) {
            $this->actingAs($this->admin)->postJson($actions, ['action' => $action, 'reason' => 'Misleading photos.'])
                ->assertUnprocessable()
                ->assertJsonValidationErrors(['action']);
        }
        $this->assertSame(AccountStatus::Active, $this->mochi->fresh()->getStatus());

        DB::table(config('session.table', 'sessions'))->insert([
            'id' => 'mochi-session',
            'user_id' => $this->mochi->id,
            'payload' => '',
            'last_activity' => now()->timestamp,
        ]);

        $this->actingAs($this->admin)->postJson($actions, ['action' => 'suspend_account', 'reason' => 'Misleading photos.'])
            ->assertOk()
            ->assertJsonPath('data.status', 'resolved')
            ->assertJsonPath('data.reported_user.status', 'suspended');

        $this->assertSame(AccountStatus::Suspended, $this->mochi->fresh()->getStatus());
        $this->assertDatabaseMissing(config('session.table', 'sessions'), ['user_id' => $this->mochi->id]);
        $this->assertDatabaseHas('account_actions', ['user_id' => $this->mochi->id, 'action' => 'suspend', 'reason' => 'Misleading photos.']);

        // Already suspended: a second report on the account can be dismissed, not suspended again.
        $again = (int) $this->actingAs($this->reporter('Paolo Garcia'))
            ->postJson('/api/v1/reports', ['target_type' => 'account', 'target_id' => $this->mochi->id, 'reason' => 'spam_or_scam'])
            ->assertCreated()
            ->json('data.id');
        $this->actingAs($this->admin)
            ->postJson("/api/v1/admin/reports/{$again}/actions", ['action' => 'suspend_account', 'reason' => 'Again.'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['action']);
    }
}
