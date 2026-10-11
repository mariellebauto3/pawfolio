<?php

declare(strict_types=1);

namespace Tests\Feature\Accounts;

use App\Enums\AccountStatus;
use App\Enums\AdoptionRequestStatus;
use App\Enums\PetStatus;
use App\Models\Adoption;
use App\Models\AdoptionRequest;
use App\Models\DetailChangeRequest;
use App\Models\HomeProfile;
use App\Models\MeetAndGreet;
use App\Models\Pet;
use App\Models\Report;
use App\Models\User;
use App\Models\VerificationSubmission;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Accounts as an admin manages them (BE-23, FE-22, AC-06…AC-10, FR34): the list, one account's page, suspend,
 * reactivate and deactivate, each with its reason, and the review of a change to a locked detail (AC-03).
 */
class AdminAccountsTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private User $mochi;

    private User $ana;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');

        $this->admin = User::factory()->admin()->active()->create(['name' => 'admin.jess']);
        $this->mochi = User::factory()->pet()->active()->create(['name' => 'Mochi', 'email' => 'mochi@example.com']);
        Pet::factory()->for($this->mochi)->lookingForAHome()->create(['name' => 'Mochi', 'breed' => 'Aspin', 'approximate_age_months' => 24, 'caretaker_name' => 'Joy Lim']);
        $this->ana = User::factory()->human()->active()->create(['name' => 'Ana Santos', 'email' => 'ana.santos@example.com']);
        HomeProfile::factory()->for($this->ana)->openToAdopt()->create(['full_name' => 'Ana Santos', 'city' => 'Quezon City']);
    }

    private function openSession(User $user): void
    {
        DB::table(config('session.table', 'sessions'))->insert(['id' => "session-{$user->id}", 'user_id' => $user->id, 'payload' => '', 'last_activity' => now()->timestamp]);
    }

    public function test_only_an_admin_reaches_the_accounts_and_never_an_admins_own(): void
    {
        $paths = [
            ['getJson', '/api/v1/admin/accounts'],
            ['getJson', "/api/v1/admin/accounts/{$this->ana->id}"],
            ['postJson', "/api/v1/admin/accounts/{$this->ana->id}/suspend"],
            ['postJson', "/api/v1/admin/accounts/{$this->ana->id}/reactivate"],
            ['postJson', "/api/v1/admin/accounts/{$this->ana->id}/deactivate"],
            ['getJson', '/api/v1/admin/change-requests'],
        ];

        foreach ($paths as [$method, $path]) {
            $this->{$method}($path, ['reason' => 'Because.'])->assertUnauthorized();
        }
        // A member can't act on another account, or on their own: these are admin endpoints (SEC-AUTHZ-07).
        foreach ($paths as [$method, $path]) {
            $this->actingAs($this->ana)->{$method}($path, ['reason' => 'Because.'])->assertForbidden();
        }
        $this->actingAs($this->mochi)->postJson("/api/v1/admin/accounts/{$this->mochi->id}/reactivate", ['reason' => 'Mine.'])->assertForbidden();
        $this->assertSame(AccountStatus::Active, $this->ana->fresh()->getStatus());

        $this->actingAs($this->admin)->getJson("/api/v1/admin/accounts/{$this->admin->id}")->assertNotFound();
        $this->actingAs($this->admin)->postJson("/api/v1/admin/accounts/{$this->admin->id}/suspend", ['reason' => 'Oops.'])->assertForbidden();
        $this->actingAs($this->admin)->postJson("/api/v1/admin/accounts/{$this->admin->id}/deactivate", ['reason' => 'Oops.'])->assertForbidden();
        $this->actingAs($this->admin)->getJson('/api/v1/admin/accounts/999')->assertNotFound();
    }

    public function test_the_list_filters_by_tab_status_and_search_and_names_an_alumnis_furparent(): void
    {
        $luna = User::factory()->pet()->active()->create(['name' => 'Luna']);
        $lunaPet = Pet::factory()->for($luna)->adopted()->create(['name' => 'Luna']);
        Adoption::factory()->create([
            'pet_id' => $lunaPet->id,
            'home_profile_id' => $this->ana->homeProfile->id,
            'adoption_request_id' => AdoptionRequest::factory()->for($lunaPet)->for($this->ana->homeProfile, 'homeProfile')->adopted()->create()->id,
        ]);
        // The factory's `suspended()` state makes a human, so the status is set by hand for a suspended pet.
        $biscuit = User::factory()->pet()->create(['name' => 'Biscuit', 'status' => AccountStatus::Suspended->value]);
        Pet::factory()->for($biscuit)->create(['name' => 'Biscuit']);

        $names = fn (string $query) => collect($this->actingAs($this->admin)->getJson("/api/v1/admin/accounts{$query}")->assertOk()->json('data'))->pluck('display_name')->sort()->values()->all();

        // Pet and Human accounts only: admins are never listed.
        $this->assertSame(['Ana Santos', 'Biscuit', 'Luna', 'Mochi'], $names(''));
        $this->assertSame(['Biscuit', 'Luna', 'Mochi'], $names('?tab=pet'));
        $this->assertSame(['Ana Santos'], $names('?tab=human'));
        $this->assertSame(['Luna'], $names('?tab=alumni'));
        $this->assertSame(['Biscuit'], $names('?status=suspended'));
        $this->assertSame([], $names('?tab=human&status=suspended'));
        $this->assertSame(['Mochi'], $names('?q=moch'));
        $this->assertSame(['Ana Santos'], $names('?q=ana.santos@'));

        $this->actingAs($this->admin)->getJson('/api/v1/admin/accounts?tab=alumni')
            ->assertJsonPath('data.0.role', 'pet')
            ->assertJsonPath('data.0.pet.status', 'adopted_hired')
            ->assertJsonPath('data.0.adoption.furparent_name', 'Ana Santos');
        $this->actingAs($this->admin)->getJson('/api/v1/admin/accounts?q=moch')
            ->assertJsonPath('data.0.caretaker_name', 'Joy Lim')
            ->assertJsonPath('data.0.adoption', null);

        // A filter the API doesn't know is refused, not passed on (SEC-INPUT-03).
        $this->actingAs($this->admin)->getJson('/api/v1/admin/accounts?status=banned')->assertUnprocessable()->assertJsonValidationErrors(['status']);
        $this->actingAs($this->admin)->getJson('/api/v1/admin/accounts?tab=admins')->assertUnprocessable()->assertJsonValidationErrors(['tab']);
    }

    public function test_an_accounts_page_carries_its_history_requests_verification_and_reports(): void
    {
        VerificationSubmission::factory()->approved()->create(['user_id' => $this->mochi->id, 'reviewed_by_user_id' => $this->admin->id]);
        AdoptionRequest::factory()->for($this->mochi->pet)->for($this->ana->homeProfile, 'homeProfile')->create();
        Report::factory()->create(['reporter_user_id' => $this->ana->id, 'reported_user_id' => $this->mochi->id, 'reason' => 'spam_or_scam']);
        DetailChangeRequest::factory()->create(['user_id' => $this->mochi->id, 'field' => 'breed', 'new_value' => 'Shih Tzu mix', 'reason' => 'The vet says so.']);

        $this->actingAs($this->admin)->getJson("/api/v1/admin/accounts/{$this->mochi->id}")
            ->assertOk()
            ->assertJsonPath('data.display_name', 'Mochi')
            ->assertJsonPath('data.role', 'pet')
            ->assertJsonPath('data.status', 'active')
            ->assertJsonPath('data.caretaker_name', 'Joy Lim')
            ->assertJsonPath('data.account_actions', [])
            ->assertJsonPath('data.verification.status', 'approved')
            ->assertJsonPath('data.verification.reviewed_by', 'admin.jess')
            ->assertJsonCount(1, 'data.requests')
            ->assertJsonPath('data.requests.0.pet_name', 'Mochi')
            ->assertJsonPath('data.requests.0.home_name', 'Ana Santos')
            ->assertJsonPath('data.requests.0.status', 'sent')
            ->assertJsonPath('data.reports_against.total', 1)
            ->assertJsonPath('data.reports_against.open', 1)
            ->assertJsonPath('data.reports_against.latest.0.reason', 'spam_or_scam')
            ->assertJsonPath('data.detail_change_requests.0.field', 'breed')
            ->assertJsonPath('data.detail_change_requests.0.current_value', 'Aspin')
            ->assertJsonPath('data.detail_change_requests.0.new_value', 'Shih Tzu mix')
            ->assertJsonPath('data.detail_change_requests.0.has_document', false)
            // Contact numbers and addresses aren't part of the page (SEC-PRIV-02).
            ->assertJsonMissingPath('data.pet.caretaker_contact_number')
            ->assertJsonMissingPath('data.home_profile.street_address');
    }

    public function test_suspending_needs_a_reason_ends_the_sessions_and_closes_open_requests(): void
    {
        // Mochi is In Process with Ana and has a Meet & Greet booked.
        $this->mochi->pet->update(['status' => PetStatus::InProcess->value]);
        $request = AdoptionRequest::factory()->for($this->mochi->pet)->for($this->ana->homeProfile, 'homeProfile')->meetScheduled()->create();
        $meeting = MeetAndGreet::factory()->confirmed()->create(['adoption_request_id' => $request->id]);
        $this->openSession($this->ana);
        $suspend = "/api/v1/admin/accounts/{$this->ana->id}/suspend";

        $this->actingAs($this->admin)->postJson($suspend, ['reason' => '   '])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['reason']);
        $this->assertSame(AccountStatus::Active, $this->ana->fresh()->getStatus());

        $this->actingAs($this->admin)->postJson($suspend, ['reason' => 'Multiple confirmed reports of a misleading profile.'])
            ->assertOk()
            ->assertJsonPath('data.status', 'suspended');

        $this->assertSame(AccountStatus::Suspended, $this->ana->fresh()->getStatus());
        // Signed out everywhere, at once (SEC-ABUSE-04).
        $this->assertDatabaseMissing(config('session.table', 'sessions'), ['user_id' => $this->ana->id]);
        $this->assertDatabaseHas('account_actions', ['user_id' => $this->ana->id, 'performed_by_user_id' => $this->admin->id, 'action' => 'suspend']);
        $this->assertDatabaseHas('activity_logs', ['action' => 'account_suspended', 'actor_user_id' => $this->admin->id, 'before_value' => 'active', 'after_value' => 'suspended']);

        // The request is Closed (proposal §5.3), its meeting ended, and Mochi is told and free to look again.
        $this->assertSame(AdoptionRequestStatus::Closed, $request->fresh()->getStatus());
        $this->assertSame('ended', $meeting->fresh()->status);
        $this->assertSame(PetStatus::LookingForAHome, $this->mochi->pet->fresh()->getStatusEnum());
        $this->assertDatabaseHas('notifications', ['user_id' => $this->mochi->id, 'title' => 'The adoption request with Ana Santos was closed']);

        // The suspended account is blocked on its next call, and the page shows the suspension.
        $this->actingAs($this->ana->fresh())->getJson('/api/v1/settings')->assertForbidden()->assertJsonPath('code', 'account_not_active');
        $this->actingAs($this->admin)->getJson("/api/v1/admin/accounts/{$this->ana->id}")
            ->assertJsonPath('data.account_actions.0.action', 'suspend')
            ->assertJsonPath('data.account_actions.0.reason', 'Multiple confirmed reports of a misleading profile.')
            ->assertJsonPath('data.account_actions.0.performed_by', 'admin.jess')
            ->assertJsonPath('data.account_actions.0.by_owner', false);

        $this->actingAs($this->admin)->postJson($suspend, ['reason' => 'Again.'])->assertConflict()->assertJsonPath('code', 'already_suspended');

        // An account that isn't Active yet is decided in Verification, not suspended.
        $pending = User::factory()->pet()->pendingVerification()->create();
        $this->actingAs($this->admin)->postJson("/api/v1/admin/accounts/{$pending->id}/suspend", ['reason' => 'Looks fake.'])
            ->assertConflict()
            ->assertJsonPath('code', 'cannot_suspend');
    }

    public function test_only_a_suspended_account_is_reactivated_with_a_note_for_the_log(): void
    {
        $reactivate = fn (User $user, array $input = ['reason' => 'Owner verified the photos with a vet certificate.']) => $this->actingAs($this->admin)->postJson("/api/v1/admin/accounts/{$user->id}/reactivate", $input);

        $reactivate($this->ana)->assertConflict()->assertJsonPath('code', 'not_suspended');

        $this->actingAs($this->admin)->postJson("/api/v1/admin/accounts/{$this->ana->id}/suspend", ['reason' => 'Under review.'])->assertOk();
        $reactivate($this->ana, [])->assertUnprocessable()->assertJsonValidationErrors(['reason']);
        $reactivate($this->ana)->assertOk()->assertJsonPath('data.status', 'active');

        $this->assertSame(AccountStatus::Active, $this->ana->fresh()->getStatus());
        $this->assertDatabaseHas('account_actions', ['user_id' => $this->ana->id, 'action' => 'reactivate', 'reason' => 'Owner verified the photos with a vet certificate.']);
        $this->assertDatabaseHas('activity_logs', ['action' => 'account_reactivated', 'before_value' => 'suspended', 'after_value' => 'active']);
        $this->actingAs($this->ana->fresh())->getJson('/api/v1/settings')->assertOk();

        // A deactivated account stays closed (proposal §5.1).
        $this->actingAs($this->admin)->postJson("/api/v1/admin/accounts/{$this->mochi->id}/deactivate", ['reason' => 'Duplicate account.'])->assertOk();
        $reactivate($this->mochi)->assertConflict()->assertJsonPath('code', 'not_suspended');
    }

    public function test_deactivating_needs_a_reason_and_keeps_the_records(): void
    {
        $request = AdoptionRequest::factory()->for($this->mochi->pet)->for($this->ana->homeProfile, 'homeProfile')->create();
        $this->openSession($this->mochi);
        $deactivate = "/api/v1/admin/accounts/{$this->mochi->id}/deactivate";

        $this->actingAs($this->admin)->postJson($deactivate, [])->assertUnprocessable()->assertJsonValidationErrors(['reason']);

        $this->actingAs($this->admin)->postJson($deactivate, ['reason' => 'Duplicate account.'])
            ->assertOk()
            ->assertJsonPath('data.status', 'deactivated');

        $this->assertSame(AccountStatus::Deactivated, $this->mochi->fresh()->getStatus());
        $this->assertDatabaseMissing(config('session.table', 'sessions'), ['user_id' => $this->mochi->id]);
        $this->assertSame(AdoptionRequestStatus::Closed, $request->fresh()->getStatus());
        $this->assertDatabaseHas('notifications', ['user_id' => $this->ana->id, 'title' => 'The adoption request with Mochi was closed']);
        $this->assertDatabaseHas('activity_logs', ['action' => 'account_deactivated', 'actor_user_id' => $this->admin->id, 'reason' => 'Duplicate account.']);
        $this->assertDatabaseHas('pets', ['id' => $this->mochi->pet->id]);

        $this->actingAs($this->admin)->postJson($deactivate, ['reason' => 'Again.'])->assertConflict()->assertJsonPath('code', 'already_deactivated');
    }

    public function test_a_change_to_a_locked_detail_is_approved_or_denied_once_and_its_document_is_for_admins(): void
    {
        Storage::disk('local')->put('verification/change-requests/vet-card.pdf', "%PDF-1.4\n1 0 obj\n<<>>\nendobj\n");
        $name = DetailChangeRequest::factory()->create(['user_id' => $this->mochi->id, 'field' => 'name', 'new_value' => 'Mocha', 'reason' => 'Renamed at the shelter.']);
        $age = DetailChangeRequest::factory()->create([
            'user_id' => $this->mochi->id, 'field' => 'approximate_age_months', 'new_value' => '36', 'reason' => 'The vet says three years.',
            'document_path' => 'verification/change-requests/vet-card.pdf',
        ]);
        $review = fn (DetailChangeRequest $cr, array $input) => $this->actingAs($this->admin)->postJson("/api/v1/admin/change-requests/{$cr->id}/review", $input);

        $this->actingAs($this->admin)->getJson('/api/v1/admin/change-requests')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.user_display_name', 'Mochi');

        // The supporting document: the file itself for an admin, nothing for anyone else (SEC-PRIV-01).
        $document = "/api/v1/admin/change-requests/{$age->id}/document";
        $this->actingAs($this->admin)->get($document)
            ->assertOk()
            ->assertHeader('Content-Type', 'application/pdf')
            ->assertHeader('X-Content-Type-Options', 'nosniff');
        $this->actingAs($this->mochi)->getJson($document)->assertForbidden();
        $this->actingAs($this->admin)->getJson("/api/v1/admin/change-requests/{$name->id}/document")->assertNotFound();

        // A denial says why.
        $review($name, ['decision' => 'denied'])->assertUnprocessable()->assertJsonValidationErrors(['reason']);
        $review($name, ['decision' => 'maybe', 'reason' => 'Hmm.'])->assertUnprocessable()->assertJsonValidationErrors(['decision']);
        $review($name, ['decision' => 'denied', 'reason' => 'The ID still says Mochi.'])
            ->assertOk()
            ->assertJsonPath('data.status', 'denied')
            ->assertJsonPath('data.reviewed_by', 'admin.jess');
        $this->assertSame('Mochi', $this->mochi->pet->fresh()->name);
        $this->assertDatabaseHas('notifications', ['user_id' => $this->mochi->id, 'title' => 'Your request to change your name was denied']);

        // An approval writes the new value, as the number the column holds.
        $review($age, ['decision' => 'approved'])
            ->assertOk()
            ->assertJsonPath('data.status', 'approved')
            ->assertJsonPath('data.current_value', '36');
        $this->assertSame(36, (int) $this->mochi->pet->fresh()->approximate_age_months);
        $this->assertDatabaseHas('notifications', ['user_id' => $this->mochi->id, 'title' => 'Your approximate age was changed']);
        $this->assertDatabaseHas('activity_logs', ['action' => 'detail_change_approved', 'actor_user_id' => $this->admin->id, 'before_value' => '24', 'after_value' => '36']);

        $review($age, ['decision' => 'denied', 'reason' => 'Changed my mind.'])->assertConflict()->assertJsonPath('code', 'already_reviewed');
        $this->assertSame(36, (int) $this->mochi->pet->fresh()->approximate_age_months);
    }

    public function test_a_suspension_that_comes_from_a_report_closes_open_requests_too(): void
    {
        $request = AdoptionRequest::factory()->for($this->mochi->pet)->for($this->ana->homeProfile, 'homeProfile')->create();
        $report = Report::factory()->onAccount()->create(['reporter_user_id' => $this->ana->id, 'reported_user_id' => $this->mochi->id]);
        $this->openSession($this->mochi);

        $this->actingAs($this->admin)->postJson("/api/v1/admin/reports/{$report->id}/actions", ['action' => 'suspend_account', 'reason' => 'Selling animals.'])
            ->assertOk();

        $this->assertSame(AccountStatus::Suspended, $this->mochi->fresh()->getStatus());
        $this->assertDatabaseMissing(config('session.table', 'sessions'), ['user_id' => $this->mochi->id]);
        $this->assertSame(AdoptionRequestStatus::Closed, $request->fresh()->getStatus());
        $this->assertDatabaseHas('activity_logs', ['action' => 'account_suspended_from_report', 'after_value' => 'suspended']);
        // One notification about the suspension: the report's own.
        $this->assertSame(1, DB::table('notifications')->where('user_id', $this->mochi->id)->count());
    }
}
