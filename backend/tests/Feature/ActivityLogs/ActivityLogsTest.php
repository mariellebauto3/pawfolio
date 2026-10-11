<?php

declare(strict_types=1);

namespace Tests\Feature\ActivityLogs;

use App\Enums\ActivityLogType;
use App\Models\ActivityLog;
use App\Models\AdoptionRequest;
use App\Models\HomeProfile;
use App\Models\MeetAndGreet;
use App\Models\Pet;
use App\Models\Report;
use App\Models\User;
use App\Services\ActivityLogs\ActivityLogger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * Activity logs (BE-26, FE-26, LG-01…LG-04, FR41, NFR9): what a member reads of their own activity and what is
 * kept from them, what an admin reads and how the log is narrowed, the CSV exports, and that the log is only read.
 */
class ActivityLogsTest extends TestCase
{
    use RefreshDatabase;

    private const MINE = '/api/v1/activity';

    private const ALL = '/api/v1/admin/activity-logs';

    private const EDGE = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0';

    private User $admin;

    private User $mochi;

    private Pet $pet;

    private User $ana;

    private HomeProfile $home;

    private AdoptionRequest $request;

    protected function setUp(): void
    {
        parent::setUp();

        // Noon on Oct 10 in the Philippines.
        $this->travelTo(Carbon::parse('2026-10-10 04:00:00', 'UTC'));

        $this->admin = User::factory()->admin()->active()->create(['name' => 'admin.jess']);
        $this->mochi = User::factory()->pet()->active()->create(['name' => 'Mochi']);
        $this->pet = Pet::factory()->for($this->mochi)->lookingForAHome()->create(['name' => 'Mochi']);
        $this->ana = User::factory()->human()->active()->create(['name' => 'Ana Santos']);
        $this->home = HomeProfile::factory()->for($this->ana)->openToAdopt()->create(['full_name' => 'Ana Santos']);
        $this->request = AdoptionRequest::factory()->approved()->create(['pet_id' => $this->pet->id, 'home_profile_id' => $this->home->id]);
    }

    /** Writes an entry a minute after the last one, so "newest first" has an order to keep. */
    private function log(ActivityLogType $type, string $action, ?User $actor = null, mixed $subject = null, ?string $before = null, ?string $after = null, ?string $reason = null, ?string $userAgent = null): ActivityLog
    {
        $this->travel(1)->minutes();

        return ActivityLogger::log(type: $type, action: $action, actor: $actor, subject: $subject, before: $before, after: $after, reason: $reason, userAgent: $userAgent);
    }

    /** A day of Mochi's life on the platform, and things that are nobody's business but an admin's. */
    private function story(): void
    {
        $this->log(ActivityLogType::Verification, 'account_approved', $this->admin, $this->mochi, 'pending_verification', 'active', 'Documents complete');
        $this->log(ActivityLogType::Security, 'signed_in', $this->mochi, $this->mochi, userAgent: self::EDGE);
        $this->log(ActivityLogType::Request, 'adoption_request_sent', $this->mochi, $this->request, null, 'sent');
        $this->log(ActivityLogType::Request, 'adoption_request_approved', $this->ana, $this->request, 'sent', 'approved');
        $this->log(ActivityLogType::StatusChange, 'pet_status_in_process', null, $this->pet, 'looking_for_a_home', 'in_process', "Request #{$this->request->id} approved");

        // Not Mochi's: another pet's request, Ana's own sign-in, and a report filed against Mochi.
        $other = AdoptionRequest::factory()->create(['home_profile_id' => $this->home->id]);
        $this->log(ActivityLogType::Request, 'adoption_request_sent', $other->pet->user, $other, null, 'sent');
        $this->log(ActivityLogType::Security, 'signed_in', $this->ana, $this->ana, userAgent: self::EDGE);
        $report = Report::factory()->onAccount()->create(['reporter_user_id' => $this->ana->id, 'reported_user_id' => $this->mochi->id]);
        $this->log(ActivityLogType::Moderation, 'report_submitted', $this->ana, $report, reason: 'fake_profile');
    }

    public function test_a_member_reads_what_they_did_and_what_was_done_to_their_account_pet_and_requests(): void
    {
        $this->story();

        $this->actingAs($this->mochi)->getJson(self::MINE)
            ->assertOk()
            ->assertJsonPath('meta.total', 5)
            ->assertJsonPath('data.*.action', ['pet_status_in_process', 'adoption_request_approved', 'adoption_request_sent', 'signed_in', 'account_approved'])
            ->assertJsonPath('data.0.actor', ['display_name' => 'System', 'role' => 'system', 'is_you' => false])
            ->assertJsonPath('data.0.subject_label', 'Mochi')
            ->assertJsonPath('data.0.before_value', 'looking_for_a_home')
            ->assertJsonPath('data.0.after_value', 'in_process')
            // The other side of the pet's own request is named.
            ->assertJsonPath('data.1.actor', ['display_name' => 'Ana Santos', 'role' => 'human', 'is_you' => false])
            ->assertJsonPath('data.1.subject_label', 'Mochi to Ana Santos')
            ->assertJsonPath('data.1.target', ['kind' => 'request', 'id' => $this->request->id])
            ->assertJsonPath('data.2.actor.is_you', true)
            ->assertJsonPath('data.3.device', 'Edge on Windows');
    }

    public function test_a_member_never_reads_an_admins_name_a_reason_or_anyone_elses_id(): void
    {
        $this->story();

        $response = $this->actingAs($this->mochi)->getJson(self::MINE)->assertOk();

        $response->assertJsonPath('data.4.action', 'account_approved')
            ->assertJsonPath('data.4.actor', ['display_name' => 'An admin', 'role' => 'admin', 'is_you' => false])
            // An account isn't a page a member can open.
            ->assertJsonPath('data.4.target', null);

        foreach ($response->json('data') as $entry) {
            $this->assertArrayNotHasKey('reason', $entry);
            $this->assertArrayNotHasKey('subject_id', $entry);
            $this->assertArrayNotHasKey('user_agent', $entry);
            $this->assertArrayNotHasKey('id', $entry['actor']);
        }

        $body = $response->getContent();
        $this->assertStringNotContainsString('admin.jess', $body);
        $this->assertStringNotContainsString('Documents complete', $body);
        // Who reported the account, and that anyone did, stays with the admins (SEC-ABUSE-02).
        $this->assertStringNotContainsString('report_submitted', $body);
        $this->assertStringNotContainsString('fake_profile', $body);
    }

    public function test_each_side_of_a_request_reads_its_own_half(): void
    {
        $this->story();

        // Ana reads the requests of her home, her sign-in and her report; never Mochi's sign-in or approval.
        $this->actingAs($this->ana)->getJson(self::MINE)
            ->assertOk()
            ->assertJsonPath('data.*.action', ['report_submitted', 'signed_in', 'adoption_request_sent', 'adoption_request_approved', 'adoption_request_sent'])
            ->assertJsonPath('data.0.actor.is_you', true)
            ->assertJsonPath('data.0.target', null);
    }

    public function test_an_account_with_no_pet_and_no_home_profile_reads_only_its_own_entries(): void
    {
        $this->story();
        $loose = User::factory()->pet()->active()->create(['name' => 'Kulit']);
        $this->log(ActivityLogType::Security, 'signed_in', $loose, $loose);

        $this->actingAs($loose)->getJson(self::MINE)
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.action', 'signed_in');
    }

    public function test_a_member_narrows_their_activity_by_type(): void
    {
        $this->story();

        $this->actingAs($this->mochi)->getJson(self::MINE.'?type=request')
            ->assertOk()
            ->assertJsonPath('data.*.action', ['adoption_request_approved', 'adoption_request_sent']);

        $this->actingAs($this->mochi)->getJson(self::MINE.'?type=security,status_change')
            ->assertOk()
            ->assertJsonPath('data.*.type', ['status_change', 'security']);

        $this->actingAs($this->mochi)->getJson(self::MINE.'?type=everything')->assertUnprocessable()->assertJsonValidationErrors('type.0');
        $this->actingAs($this->mochi)->getJson(self::MINE.'?page=0')->assertUnprocessable();
        $this->actingAs($this->mochi)->getJson(self::MINE.'?per_page=500')->assertOk()->assertJsonPath('meta.per_page', 50);
    }

    public function test_my_activity_is_for_signed_in_active_accounts(): void
    {
        $this->getJson(self::MINE)->assertUnauthorized();
        $this->getJson(self::MINE.'/export')->assertUnauthorized();

        $pending = User::factory()->create(['role' => 'pet', 'status' => 'pending_verification']);
        $this->actingAs($pending)->getJson(self::MINE)->assertForbidden()->assertJsonPath('code', 'account_not_active');
    }

    public function test_an_admin_reads_every_entry_whole(): void
    {
        $this->story();

        $response = $this->actingAs($this->admin)->getJson(self::ALL)
            ->assertOk()
            ->assertJsonPath('meta.total', 8)
            ->assertJsonPath('data.0.action', 'report_submitted')
            ->assertJsonPath('data.0.actor', ['id' => $this->ana->id, 'display_name' => 'Ana Santos', 'role' => 'human', 'is_you' => false])
            ->assertJsonPath('data.0.reason', 'fake_profile')
            ->assertJsonPath('data.0.subject_type', 'Report')
            ->assertJsonPath('data.7.action', 'account_approved')
            ->assertJsonPath('data.7.actor', ['id' => $this->admin->id, 'display_name' => 'admin.jess', 'role' => 'admin', 'is_you' => true])
            ->assertJsonPath('data.7.reason', 'Documents complete')
            ->assertJsonPath('data.7.subject_label', 'Mochi')
            ->assertJsonPath('data.7.target', ['kind' => 'account', 'id' => $this->mochi->id])
            ->assertJsonPath('data.3.action', 'pet_status_in_process')
            ->assertJsonPath('data.3.actor', ['display_name' => 'System', 'role' => 'system', 'is_you' => false, 'id' => null])
            ->assertJsonPath('data.3.target', ['kind' => 'account', 'id' => $this->mochi->id]);

        $this->assertSame(['kind' => 'report', 'id' => $response->json('data.0.subject_id')], $response->json('data.0.target'));
        // The list carries no raw user agent; one entry's detail does.
        $this->assertArrayNotHasKey('user_agent', $response->json('data.0'));
    }

    public function test_an_entry_names_what_it_was_about_even_when_the_record_is_gone(): void
    {
        $meeting = MeetAndGreet::factory()->create(['adoption_request_id' => $this->request->id]);
        $this->log(ActivityLogType::MeetAndGreet, 'meet_and_greet_booked', $this->mochi, $meeting, null, 'booked');
        ActivityLogger::log(type: ActivityLogType::Feed, action: 'post_deleted', actor: $this->mochi, subjectTypeOverride: 'App\\Models\\Post', subjectIdOverride: 999);
        // A class name in the table is data: one the log doesn't know is named, never loaded.
        ActivityLogger::log(type: ActivityLogType::System, action: 'odd_entry', subjectTypeOverride: 'App\\Nope\\Missing', subjectIdOverride: 4);
        $this->log(ActivityLogType::Security, 'sign_in_failed');

        $this->actingAs($this->admin)->getJson(self::ALL)
            ->assertOk()
            ->assertJsonPath('data.0.subject_label', null)
            ->assertJsonPath('data.0.target', null)
            ->assertJsonPath('data.1.subject_label', 'Missing #4')
            ->assertJsonPath('data.2.subject_label', 'Post #999')
            ->assertJsonPath('data.3.subject_label', 'Mochi to Ana Santos')
            ->assertJsonPath('data.3.target', ['kind' => 'request', 'id' => $this->request->id]);
    }

    public function test_an_admin_narrows_the_log_by_type_actor_and_words(): void
    {
        $this->story();
        $this->log(ActivityLogType::Account, 'account_suspended', $this->admin, $this->ana, 'active', 'suspended', 'Selling animals in posts');

        $actions = fn (string $query) => $this->actingAs($this->admin)->getJson(self::ALL.$query)->assertOk()->json('data.*.action');

        $this->assertSame(['signed_in', 'signed_in'], $actions('?type=security'));
        $this->assertSame(['account_suspended', 'account_approved'], $actions('?type=account,verification'));
        $this->assertSame(['pet_status_in_process'], $actions('?actor_role=system'));
        $this->assertSame(['account_suspended', 'account_approved'], $actions('?actor_role=admin'));
        $this->assertSame(['adoption_request_sent', 'adoption_request_sent', 'signed_in'], $actions('?actor_role=pet'));
        $this->assertSame(['adoption_request_sent', 'signed_in'], $actions("?actor_user_id={$this->mochi->id}"));
        $this->assertSame(['account_suspended'], $actions('?q=selling'));
        // An action's name is found by its words, and a % or _ is a character, not a wildcard.
        $this->assertSame(['account_suspended'], $actions('?q=account suspended'));
        $this->assertSame(['account_suspended'], $actions('?q=SELLING animals'));
        $this->assertSame([], $actions('?q=%25'));
        $this->assertSame([], $actions('?q=sell_ng'));
        $this->assertSame(['account_approved'], $actions('?actor_role=admin&type=verification'));
    }

    public function test_the_logs_filters_are_allow_listed(): void
    {
        foreach (['type=everything' => 'type.0', 'actor_role=owner' => 'actor_role', 'actor_user_id=abc' => 'actor_user_id', 'q='.str_repeat('a', 101) => 'q'] as $query => $field) {
            $this->actingAs($this->admin)->getJson(self::ALL.'?'.$query)->assertUnprocessable()->assertJsonValidationErrors($field);
        }

        $this->actingAs($this->admin)->getJson(self::ALL.'?per_page=500')->assertOk()->assertJsonPath('meta.per_page', 50);
    }

    public function test_one_entrys_detail_adds_the_device_it_came_from(): void
    {
        $entry = $this->log(ActivityLogType::Security, 'signed_in', $this->mochi, $this->mochi, userAgent: self::EDGE);

        $this->actingAs($this->admin)->getJson(self::ALL."/{$entry->id}")
            ->assertOk()
            ->assertJsonPath('data.id', $entry->id)
            ->assertJsonPath('data.device', 'Edge on Windows')
            ->assertJsonPath('data.user_agent', self::EDGE)
            ->assertJsonPath('data.is_append_only', true)
            ->assertJsonPath('data.target', ['kind' => 'account', 'id' => $this->mochi->id]);

        $this->actingAs($this->admin)->getJson(self::ALL.'/999999')->assertNotFound();
        $this->actingAs($this->admin)->getJson(self::ALL.'/abc')->assertNotFound();
    }

    public function test_the_platform_log_is_for_active_admins_only(): void
    {
        $entry = $this->log(ActivityLogType::Security, 'signed_in', $this->mochi, $this->mochi);

        $paths = [self::ALL, self::ALL.'/export', self::ALL."/{$entry->id}"];
        foreach ($paths as $path) {
            $this->getJson($path)->assertUnauthorized();
        }
        foreach ($paths as $path) {
            $this->actingAs($this->mochi)->getJson($path)->assertForbidden();
            $this->actingAs($this->ana)->getJson($path)->assertForbidden();
        }

        $suspended = User::factory()->create(['role' => 'admin', 'status' => 'suspended']);
        $this->actingAs($suspended)->getJson(self::ALL)->assertForbidden();

        // A member's try at an admin page is itself logged (SEC-LOG-02).
        $this->assertDatabaseHas('activity_logs', ['action' => 'admin_access_denied', 'actor_user_id' => $this->mochi->id]);
    }

    public function test_the_log_can_only_be_read(): void
    {
        $entry = $this->log(ActivityLogType::Account, 'account_suspended', $this->admin, $this->ana, 'active', 'suspended', 'Selling animals in posts');

        foreach (['postJson', 'putJson', 'patchJson', 'deleteJson'] as $verb) {
            $this->actingAs($this->admin)->{$verb}(self::ALL."/{$entry->id}", ['reason' => 'Edited'])->assertStatus(405);
        }
        $this->actingAs($this->admin)->postJson(self::ALL, ['action' => 'made_up'])->assertStatus(405);
        $this->actingAs($this->mochi)->deleteJson(self::MINE)->assertStatus(405);

        $this->assertSame('Selling animals in posts', $entry->fresh()->reason);
    }

    public function test_a_member_downloads_their_own_activity_without_reasons_or_admin_names(): void
    {
        $this->story();

        $response = $this->actingAs($this->mochi)->get(self::MINE.'/export')
            ->assertOk()
            ->assertHeader('Content-Type', 'text/csv; charset=UTF-8')
            ->assertHeader('X-Content-Type-Options', 'nosniff');
        $this->assertStringContainsString('attachment; filename=my-activity.csv', (string) $response->headers->get('Content-Disposition'));

        $csv = $response->streamedContent();
        $lines = array_values(array_filter(explode("\n", trim($csv))));

        $this->assertSame('"When (Philippine time)",Who,Type,Action,About,Before,After,Device', $lines[0]);
        $this->assertCount(6, $lines);
        // 04:05 UTC is 12:05 in the Philippines.
        $this->assertStringStartsWith('"2026-10-10 12:05",System,status_change,pet_status_in_process,Mochi,looking_for_a_home,in_process', $lines[1]);
        $this->assertStringContainsString('"An admin",verification,account_approved,Mochi,pending_verification,active', $csv);
        $this->assertStringContainsString('"Edge on Windows"', $csv);
        $this->assertStringNotContainsString('admin.jess', $csv);
        $this->assertStringNotContainsString('Documents complete', $csv);
        $this->assertStringNotContainsString('report_submitted', $csv);

        // The export follows the same type filter as the list.
        $filtered = $this->actingAs($this->mochi)->get(self::MINE.'/export?type=security')->assertOk()->streamedContent();
        $this->assertCount(2, array_filter(explode("\n", trim($filtered))));
    }

    public function test_an_admin_downloads_the_log_with_reasons_and_cells_that_cant_run_as_formulas(): void
    {
        $this->story();
        $this->log(ActivityLogType::Account, 'account_suspended', $this->admin, $this->ana, 'active', 'suspended', '=HYPERLINK("https://evil.example","Open")');
        $this->log(ActivityLogType::Account, 'account_reactivated', $this->admin, $this->ana, 'suspended', 'active', '  +1 for the appeal');

        $response = $this->actingAs($this->admin)->get(self::ALL.'/export')->assertOk()->assertHeader('Content-Type', 'text/csv; charset=UTF-8');
        $this->assertStringContainsString('attachment; filename=activity-logs.csv', (string) $response->headers->get('Content-Disposition'));

        $csv = $response->streamedContent();
        $this->assertStringStartsWith('"When (Philippine time)",Who,Type,Action,About,Before,After,Reason,Device', $csv);
        $this->assertStringContainsString('admin.jess,verification,account_approved,Mochi,pending_verification,active,"Documents complete"', $csv);
        // A cell that would start a formula is written as text, also behind leading spaces.
        $this->assertStringContainsString('"\'=HYPERLINK(""https://evil.example"",""Open"")"', $csv);
        $this->assertStringContainsString('"\'  +1 for the appeal"', $csv);

        $filtered = $this->actingAs($this->admin)->get(self::ALL.'/export?actor_role=system')->assertOk()->streamedContent();
        $this->assertCount(2, array_filter(explode("\n", trim($filtered))));
        $this->actingAs($this->admin)->getJson(self::ALL.'/export?type=everything')->assertUnprocessable();
    }
}
