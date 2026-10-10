<?php

declare(strict_types=1);

namespace Tests\Feature\Accounts;

use App\Enums\AccountStatus;
use App\Enums\AdoptionRequestStatus;
use App\Models\AdoptionRequest;
use App\Models\HomeProfile;
use App\Models\Pet;
use App\Models\Report;
use App\Models\User;
use App\Models\VerificationSubmission;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The counts beside the admin sidebar's links (GN-01): each is what arrived in its section since the admin who
 * reads it last opened that section, and opening the section clears it.
 */
class AdminSidebarTest extends TestCase
{
    use RefreshDatabase;

    private const COUNTS = '/api/v1/admin/sidebar';

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo('2026-10-01 08:00:00');
        $this->admin = User::factory()->admin()->active()->create();
    }

    private function seen(string $section): string
    {
        return self::COUNTS."/{$section}/seen";
    }

    private function pendingAccount(): User
    {
        $account = User::factory()->human()->pendingVerification()->create();
        VerificationSubmission::factory()->pending()->create(['user_id' => $account->id, 'submitted_at' => now()]);

        return $account;
    }

    private function openReport(): Report
    {
        return Report::factory()->create(['status' => 'open']);
    }

    /** A request whose meeting time passed `$daysAgo` days ago with no decision. */
    private function awaitingDecision(int $daysAgo): AdoptionRequest
    {
        $pet = Pet::factory()->for(User::factory()->pet()->active())->create();
        $home = HomeProfile::factory()->for(User::factory()->human()->active())->create();

        return AdoptionRequest::factory()->create([
            'pet_id' => $pet->id,
            'home_profile_id' => $home->id,
            'status' => AdoptionRequestStatus::AwaitingDecision->value,
            'awaiting_decision_at' => now()->subDays($daysAgo),
        ]);
    }

    private function counts(User $admin): array
    {
        return $this->actingAs($admin)->getJson(self::COUNTS)->assertOk()->json('data.counts');
    }

    public function test_only_an_active_admin_reads_the_counts_or_clears_one(): void
    {
        foreach ([['GET', self::COUNTS], ['POST', $this->seen('verification')]] as [$method, $path]) {
            $this->json($method, $path)->assertUnauthorized();
        }

        foreach ([User::factory()->human()->active()->create(), User::factory()->pet()->active()->create()] as $member) {
            $this->actingAs($member)->getJson(self::COUNTS)->assertForbidden();
            $this->actingAs($member)->postJson($this->seen('verification'))->assertForbidden();
        }

        $suspended = User::factory()->admin()->create(['status' => AccountStatus::Suspended]);
        $this->actingAs($suspended)->getJson(self::COUNTS)->assertForbidden()->assertJsonPath('code', 'account_not_active');
        $this->assertDatabaseCount('admin_section_views', 0);
    }

    public function test_every_count_is_what_is_new_and_clears_once_its_section_is_opened(): void
    {
        $this->pendingAccount();
        $this->pendingAccount();
        $this->openReport();
        $this->awaitingDecision(8);
        // Not overdue yet: the meeting was 3 days ago.
        $this->awaitingDecision(3);

        // Never opened: everything waiting is news.
        $this->travelTo('2026-10-01 09:00:00');
        $this->assertSame(['verification' => 2, 'reports' => 1, 'requests' => 1], $this->counts($this->admin));

        // Opening one section clears that count and no other.
        $this->actingAs($this->admin)->postJson($this->seen('verification'))->assertNoContent();
        $this->assertSame(['verification' => 0, 'reports' => 1, 'requests' => 1], $this->counts($this->admin));

        $this->actingAs($this->admin)->postJson($this->seen('reports'))->assertNoContent();
        $this->actingAs($this->admin)->postJson($this->seen('requests'))->assertNoContent();
        $this->assertSame(['verification' => 0, 'reports' => 0, 'requests' => 0], $this->counts($this->admin));

        // Nothing was decided: the queues are as long as before, only the news is gone.
        $this->actingAs($this->admin)->getJson('/api/v1/admin/verifications')->assertOk()->assertJsonPath('meta.total', 2);
        $this->actingAs($this->admin)->getJson('/api/v1/admin/reports')->assertOk()->assertJsonPath('meta.total', 1);

        // What arrives afterwards is counted again, each in its own section.
        $this->travelTo('2026-10-01 10:00:00');
        $this->pendingAccount();
        $this->assertSame(['verification' => 1, 'reports' => 0, 'requests' => 0], $this->counts($this->admin));
        $this->openReport();
        $this->openReport();
        $this->assertSame(['verification' => 1, 'reports' => 2, 'requests' => 0], $this->counts($this->admin));

        // The request that was 3 days past its meeting becomes overdue 4 days later: that is news then.
        $this->travelTo('2026-10-05 10:00:00');
        $this->assertSame(1, $this->counts($this->admin)['requests']);
        $this->actingAs($this->admin)->postJson($this->seen('requests'))->assertNoContent();
        $this->assertSame(0, $this->counts($this->admin)['requests']);

        // Opening a section again moves its time on; there is still one row per admin and section.
        $this->actingAs($this->admin)->postJson($this->seen('requests'))->assertNoContent();
        $this->assertDatabaseCount('admin_section_views', 3);
    }

    public function test_each_admin_has_their_own_counts(): void
    {
        $other = User::factory()->admin()->active()->create();
        $this->pendingAccount();

        $this->travelTo('2026-10-01 09:00:00');
        $this->actingAs($this->admin)->postJson($this->seen('verification'))->assertNoContent();

        $this->assertSame(0, $this->counts($this->admin)['verification']);
        $this->assertSame(1, $this->counts($other)['verification']);
    }

    public function test_the_admin_the_time_and_the_section_are_never_taken_from_what_is_sent(): void
    {
        $other = User::factory()->admin()->active()->create();
        $this->pendingAccount();
        $this->travelTo('2026-10-01 09:00:00');

        // A time in the past and another admin's id are ignored (SEC-AUTHZ-02, SEC-INPUT-04).
        $this->actingAs($this->admin)
            ->postJson($this->seen('verification'), ['seen_at' => '2020-01-01 00:00:00', 'user_id' => $other->id, 'section' => 'reports'])
            ->assertNoContent();
        $this->assertDatabaseHas('admin_section_views', ['user_id' => $this->admin->id, 'section' => 'verification', 'seen_at' => '2026-10-01 09:00:00']);
        $this->assertDatabaseMissing('admin_section_views', ['user_id' => $other->id]);
        $this->assertDatabaseMissing('admin_section_views', ['section' => 'reports']);

        // A section that isn't one of the three is no page at all (SEC-INPUT-03).
        foreach (['accounts', 'dashboard', 'Verification', '1'] as $unknown) {
            $this->actingAs($this->admin)->postJson($this->seen($unknown))->assertNotFound();
        }
        $this->assertDatabaseCount('admin_section_views', 1);
    }
}
