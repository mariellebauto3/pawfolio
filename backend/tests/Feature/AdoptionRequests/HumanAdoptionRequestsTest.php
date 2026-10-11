<?php

declare(strict_types=1);

namespace Tests\Feature\AdoptionRequests;

use App\Enums\PetStatus;
use App\Models\ActivityLog;
use App\Models\AdoptionRequest;
use App\Models\HomeProfile;
use App\Models\MatchScore;
use App\Models\Pet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Adoption requests as the human that receives them (RQ-09…RQ-13, FR10, docs/api/adoption-and-meet-greet.md): an
 * Active human reads the requests sent to their home, and approves or declines one that is still Sent. Nobody else
 * answers their requests.
 */
class HumanAdoptionRequestsTest extends TestCase
{
    use RefreshDatabase;

    private User $human;

    private HomeProfile $home;

    private User $petUser;

    private Pet $pet;

    protected function setUp(): void
    {
        parent::setUp();

        $this->human = User::factory()->human()->active()->create();
        $this->home = HomeProfile::factory()->for($this->human)->openToAdopt()->create(['full_name' => 'Ana Santos']);

        $this->petUser = User::factory()->pet()->active()->create();
        $this->pet = Pet::factory()->for($this->petUser)->lookingForAHome()->create(['name' => 'Mochi', 'breed' => 'Aspin', 'approximate_age_months' => 26]);
    }

    private function listedHome(string $name): HomeProfile
    {
        return HomeProfile::factory()->for(User::factory()->human()->active())->openToAdopt()->create(['full_name' => $name]);
    }

    private function petNamed(string $name): Pet
    {
        return Pet::factory()->for(User::factory()->pet()->active())->lookingForAHome()->create(['name' => $name]);
    }

    /** A request written straight to the table, as one sent earlier: Mochi's to Ana unless told otherwise. */
    private function received(?string $state = null, array $with = [], ?Pet $from = null, ?HomeProfile $to = null): AdoptionRequest
    {
        $factory = AdoptionRequest::factory();

        return ($state === null ? $factory : $factory->{$state}())
            ->create(['pet_id' => ($from ?? $this->pet)->id, 'home_profile_id' => ($to ?? $this->home)->id, ...$with]);
    }

    private function url(AdoptionRequest $request, string $action): string
    {
        return "/api/v1/adoption-requests/{$request->id}/{$action}";
    }

    public function test_the_inbox_shares_every_request_out_over_its_three_tabs(): void
    {
        $new = $this->received(null, ['sent_at' => '2026-10-05 09:00:00']);
        $onHold = $this->received('onHold', ['sent_at' => '2026-10-04 09:00:00'], $this->petNamed('Paused'));
        $approved = $this->received('approved', ['sent_at' => '2026-10-03 09:00:00'], $this->petNamed('Approved'));
        $awaiting = $this->received('awaitingDecision', ['sent_at' => '2026-10-02 09:00:00'], $this->petNamed('Met'));
        $declined = $this->received('declined', ['sent_at' => '2026-10-01 09:00:00'], $this->petNamed('Declined'));

        // A request to another home is not Ana's to see.
        $this->received(null, [], $this->petNamed('Elsewhere'), $this->listedHome('Someone else'));

        $this->actingAs($this->human)->getJson('/api/v1/adoption-requests?tab=new')
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.id', $new->id)
            ->assertJsonPath('data.0.pet.name', 'Mochi')
            ->assertJsonPath('data.0.pet.breed', 'Aspin')
            ->assertJsonPath('data.0.pet.approximate_age_months', 26)
            // Every status is counted, whatever the tab.
            ->assertJsonCount(5, 'meta.status_counts')
            ->assertJsonPath('meta.status_counts.sent', 1)
            ->assertJsonPath('meta.status_counts.on_hold', 1)
            // The pet is named by its public summary: the caretaker's number stays private (SEC-PRIV-02).
            ->assertJsonMissingPath('data.0.pet.caretaker_contact_number')
            ->assertJsonMissingPath('data.0.pet.caretaker_name')
            ->assertJsonMissingPath('data.0.contacts');

        // In progress is everything still open that isn't new, On Hold included.
        $this->actingAs($this->human)->getJson('/api/v1/adoption-requests?tab=in_progress')
            ->assertOk()
            ->assertJsonPath('meta.total', 3)
            ->assertJsonPath('data.0.id', $onHold->id)
            ->assertJsonPath('data.1.id', $approved->id)
            ->assertJsonPath('data.2.id', $awaiting->id);

        $this->actingAs($this->human)->getJson('/api/v1/adoption-requests?tab=closed')
            ->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $declined->id);

        // Nothing is left out, and nothing is listed twice.
        $this->actingAs($this->human)->getJson('/api/v1/adoption-requests')->assertOk()->assertJsonPath('meta.total', 5);
    }

    public function test_a_human_reads_a_request_sent_to_their_home_with_the_match(): void
    {
        $request = $this->received(null, ['cover_letter' => 'I am calm indoors and I love long walks, just like your weekends.', 'caretaker_notes' => 'Walks twice a day.']);
        MatchScore::factory()->create(['pet_id' => $this->pet->id, 'home_profile_id' => $this->home->id, 'score' => 86]);

        $this->actingAs($this->human)->getJson("/api/v1/adoption-requests/{$request->id}")
            ->assertOk()
            ->assertJsonPath('data.status', 'sent')
            ->assertJsonPath('data.pet.name', 'Mochi')
            ->assertJsonPath('data.cover_letter', 'I am calm indoors and I love long walks, just like your weekends.')
            ->assertJsonPath('data.caretaker_notes', 'Walks twice a day.')
            ->assertJsonPath('data.match_score', 86)
            // Nothing private before a Meet & Greet is confirmed (SEC-PRIV-02).
            ->assertJsonPath('data.contact_unlocked', false)
            ->assertJsonPath('data.contacts', null);

        // A request to another home answers like one that doesn't exist (SEC-AUTHZ-04).
        $elsewhere = $this->received(null, [], $this->petNamed('Elsewhere'), $this->listedHome('Someone else'));
        $this->actingAs($this->human)->getJson("/api/v1/adoption-requests/{$elsewhere->id}")->assertNotFound();
    }

    public function test_approving_puts_the_pet_in_process_and_its_other_requests_on_hold(): void
    {
        $this->freezeSecond();
        $request = $this->received();
        $other = $this->received(null, ['sent_at' => now()->subDays(3), 'expires_at' => now()->addDays(11)], null, $this->listedHome('Paolo Garcia'));
        // A request that already ended stays as it is.
        $ended = $this->received('withdrawn', [], null, $this->listedHome('Earlier'));

        $this->actingAs($this->human)->postJson($this->url($request, 'approve'), ['approval_message' => '  We would love to meet Mochi!  '])
            ->assertOk()
            ->assertJsonPath('data.status', 'approved')
            // Trimmed before it is stored (SEC-INPUT-06).
            ->assertJsonPath('data.approval_message', 'We would love to meet Mochi!')
            ->assertJsonPath('data.approved_at', now()->toISOString())
            // 14 days to book a Meet & Greet (§5.3).
            ->assertJsonPath('data.expires_at', now()->addDays(14)->toISOString());

        $this->assertSame(PetStatus::InProcess, $this->pet->fresh()->getStatusEnum());

        $other->refresh();
        $this->assertSame('on_hold', $other->status);
        $this->assertNull($other->expires_at);
        $this->assertSame('withdrawn', $ended->fresh()->status);

        // The pet is told, and so is the human whose request is paused.
        $told = $this->petUser->notifications()->sole();
        $this->assertSame('request_approved', $told->type);
        $this->assertSame("/requests/{$request->id}", $told->action_url);
        $this->assertSame(1, $other->homeProfile->user->notifications()->count());

        $this->assertSame(1, ActivityLog::query()->where('action', 'adoption_request_approved')->where('actor_user_id', $this->human->id)->count());
        $this->assertSame(1, ActivityLog::query()->where('action', 'pet_status_in_process')->count());
    }

    public function test_only_a_sent_request_that_has_not_expired_is_approved(): void
    {
        foreach (['onHold', 'approved', 'declined', 'withdrawn', 'expired'] as $state) {
            $request = $this->received($state, [], $this->petNamed($state));
            $this->actingAs($this->human)->postJson($this->url($request, 'approve'))
                ->assertConflict()->assertJsonPath('code', 'invalid_request_state');
        }

        // Past its 14 days, though the nightly job hasn't closed it yet.
        $late = $this->received(null, ['expires_at' => now()->subMinute()]);
        $this->actingAs($this->human)->postJson($this->url($late, 'approve'))->assertConflict()->assertJsonPath('code', 'request_expired');
        $this->assertSame('sent', $late->fresh()->status);
        $this->assertSame(PetStatus::LookingForAHome, $this->pet->fresh()->getStatusEnum());
    }

    public function test_a_pet_that_another_home_approved_first_cannot_be_approved(): void
    {
        $request = $this->received();
        $this->pet->forceFill(['status' => PetStatus::InProcess->value])->save();

        $this->actingAs($this->human)->postJson($this->url($request, 'approve'))->assertConflict()->assertJsonPath('code', 'pet_unavailable');
        $this->assertSame('sent', $request->fresh()->status);
    }

    public function test_declining_tells_the_pet_and_starts_the_thirty_day_wait(): void
    {
        $this->freezeSecond();
        $request = $this->received();

        $this->actingAs($this->human)->postJson($this->url($request, 'decline'), [
            'decline_reason' => 'another_pet_joining',
            'decision_message' => ' Thank you, Mochi. The timing is not right. ',
        ])
            ->assertOk()
            ->assertJsonPath('data.status', 'declined')
            ->assertJsonPath('data.decline_reason', 'another_pet_joining')
            ->assertJsonPath('data.decision_message', 'Thank you, Mochi. The timing is not right.')
            ->assertJsonPath('data.closed_at', now()->toISOString())
            ->assertJsonPath('data.expires_at', null)
            ->assertJsonPath('data.cooldown_until', now()->addDays(30)->toISOString());

        // The pet stays Looking for a Home, and is told.
        $this->assertSame(PetStatus::LookingForAHome, $this->pet->fresh()->getStatusEnum());
        $told = $this->petUser->notifications()->sole();
        $this->assertSame('request_declined', $told->type);
        $this->assertSame(1, ActivityLog::query()->where('action', 'adoption_request_declined')->where('actor_user_id', $this->human->id)->count());

        // It can't apply to this home again for 30 days, and a request can't be declined twice.
        $this->actingAs($this->petUser)->postJson("/api/v1/home-profiles/{$this->home->id}/adoption-requests", ['cover_letter' => str_repeat('a', 60)])
            ->assertConflict()->assertJsonPath('code', 'request_cooldown');
        $this->actingAs($this->human)->postJson($this->url($request, 'decline'))->assertConflict()->assertJsonPath('code', 'invalid_request_state');
    }

    public function test_the_reason_and_the_messages_are_optional_and_checked(): void
    {
        $request = $this->received();
        $long = str_repeat('a', 601);

        $this->actingAs($this->human)->postJson($this->url($request, 'approve'), ['approval_message' => $long])
            ->assertUnprocessable()->assertJsonPath('errors.approval_message.0', 'Keep the message to 600 characters or fewer.');
        $this->actingAs($this->human)->postJson($this->url($request, 'decline'), ['decision_message' => $long])
            ->assertUnprocessable()->assertJsonPath('errors.decision_message.0', 'Keep the message to 600 characters or fewer.');
        $this->actingAs($this->human)->postJson($this->url($request, 'decline'), ['decline_reason' => 'too_fluffy'])
            ->assertUnprocessable()->assertJsonPath('errors.decline_reason.0', 'Choose a reason from the list, or leave it out.');
        $this->assertSame('sent', $request->fresh()->status);

        // The body can't choose the status or the dates (SEC-INPUT-04); no choice made is sent as an empty value.
        $this->actingAs($this->human)->postJson($this->url($request, 'decline'), ['decline_reason' => '', 'decision_message' => '  ', 'status' => 'adopted', 'closed_at' => '2020-01-01T00:00:00Z'])
            ->assertOk()
            ->assertJsonPath('data.status', 'declined')
            ->assertJsonPath('data.decline_reason', null)
            ->assertJsonPath('data.decision_message', null);
        $this->assertTrue($request->fresh()->closed_at->isAfter(now()->subMinute()));

        $plain = $this->received(null, [], $this->petNamed('Plain'));
        $this->actingAs($this->human)->postJson($this->url($plain, 'approve'), ['status' => 'adopted'])
            ->assertOk()->assertJsonPath('data.status', 'approved')->assertJsonPath('data.approval_message', null);
    }

    public function test_only_the_human_it_was_sent_to_answers_a_request(): void
    {
        $request = $this->received();

        $this->postJson($this->url($request, 'approve'))->assertUnauthorized();
        $this->postJson($this->url($request, 'decline'))->assertUnauthorized();

        $suspended = User::factory()->human()->suspended()->create();
        HomeProfile::factory()->for($suspended)->create();
        $this->actingAs($suspended)->postJson($this->url($request, 'approve'))->assertForbidden()->assertJsonPath('code', 'account_not_active');

        // Each is answered like a request that doesn't exist: another human, the pet that sent it, an admin.
        $someoneElse = $this->listedHome('Someone else')->user;
        foreach ([$someoneElse, $this->petUser, User::factory()->admin()->create()] as $user) {
            $this->actingAs($user)->postJson($this->url($request, 'approve'))->assertNotFound();
            $this->actingAs($user)->postJson($this->url($request, 'decline'))->assertNotFound();
        }
        $this->actingAs($this->human)->postJson('/api/v1/adoption-requests/999999/approve')->assertNotFound();
        $this->actingAs($this->human)->postJson('/api/v1/adoption-requests/999999/decline')->assertNotFound();

        $this->assertSame('sent', $request->fresh()->status);
        $this->assertSame(PetStatus::LookingForAHome, $this->pet->fresh()->getStatusEnum());
    }
}
