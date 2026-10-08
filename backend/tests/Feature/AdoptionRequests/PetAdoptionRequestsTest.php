<?php

declare(strict_types=1);

namespace Tests\Feature\AdoptionRequests;

use App\Enums\PetStatus;
use App\Models\ActivityLog;
use App\Models\AdoptionRequest;
use App\Models\HomeProfile;
use App\Models\HomeProfileHouseholdMember;
use App\Models\Invite;
use App\Models\MatchScore;
use App\Models\Pet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Adoption requests as the pet that sends them (RQ-03…RQ-08, RQ-14…RQ-17, FR24, FR25,
 * docs/api/adoption-and-meet-greet.md): an Active pet applies to a home with a cover letter, within the limits of
 * proposal §5.5, tracks what it sent, and withdraws before the final decision. Nobody else reads or ends its requests.
 */
class PetAdoptionRequestsTest extends TestCase
{
    use RefreshDatabase;

    private const LETTER = 'I am calm indoors and I love long walks, which sounds just like your weekends.';

    private User $human;

    private HomeProfile $home;

    private User $petUser;

    private Pet $pet;

    protected function setUp(): void
    {
        parent::setUp();

        $this->human = User::factory()->human()->active()->create();
        $this->home = HomeProfile::factory()->for($this->human)->openToAdopt()->create(['full_name' => 'Ana Santos', 'home_type' => 'condo']);

        $this->petUser = User::factory()->pet()->active()->create();
        $this->pet = Pet::factory()->for($this->petUser)->lookingForAHome()->create(['name' => 'Mochi']);
    }

    private function listedHome(string $name): HomeProfile
    {
        return HomeProfile::factory()->for(User::factory()->human()->active())->openToAdopt()->create(['full_name' => $name]);
    }

    /** A request from Mochi written straight to the table, as one sent earlier. `$state` is a factory state. */
    private function sent(HomeProfile $home, ?string $state = null, array $with = []): AdoptionRequest
    {
        $factory = AdoptionRequest::factory();

        return ($state === null ? $factory : $factory->{$state}())
            ->create(['pet_id' => $this->pet->id, 'home_profile_id' => $home->id, ...$with]);
    }

    private function applyUrl(?HomeProfile $home = null): string
    {
        return '/api/v1/home-profiles/'.($home ?? $this->home)->id.'/adoption-requests';
    }

    private function apply(?HomeProfile $home = null, array $body = [])
    {
        return $this->actingAs($this->petUser)->postJson($this->applyUrl($home), ['cover_letter' => self::LETTER, ...$body]);
    }

    public function test_only_a_signed_in_active_pet_applies_and_only_a_pet_or_a_human_lists(): void
    {
        $this->postJson($this->applyUrl(), ['cover_letter' => self::LETTER])->assertUnauthorized();
        $this->getJson('/api/v1/adoption-requests')->assertUnauthorized();
        $this->getJson('/api/v1/adoption-requests/1')->assertUnauthorized();
        $this->postJson('/api/v1/adoption-requests/1/withdraw')->assertUnauthorized();

        $pending = User::factory()->pet()->pendingVerification()->create();
        Pet::factory()->for($pending)->lookingForAHome()->create();
        $this->actingAs($pending)->postJson($this->applyUrl(), ['cover_letter' => self::LETTER])
            ->assertForbidden()->assertJsonPath('code', 'account_not_active');

        $suspended = User::factory()->pet()->suspended()->create();
        $this->actingAs($suspended)->getJson('/api/v1/adoption-requests')->assertForbidden()->assertJsonPath('code', 'account_not_active');

        // A human doesn't apply, and neither does an admin.
        $this->actingAs($this->human)->postJson($this->applyUrl(), ['cover_letter' => self::LETTER])->assertForbidden();
        $admin = User::factory()->admin()->create();
        $this->actingAs($admin)->postJson($this->applyUrl(), ['cover_letter' => self::LETTER])->assertForbidden();

        // An admin reads requests on the monitor under /admin, not here.
        $this->actingAs($admin)->getJson('/api/v1/adoption-requests')->assertForbidden();

        $this->assertSame(0, AdoptionRequest::query()->count());
    }

    public function test_a_pet_applies_and_the_human_is_told(): void
    {
        $this->freezeSecond();
        (new HomeProfileHouseholdMember)->forceFill(['home_profile_id' => $this->home->id, 'member' => 'partner'])->save();

        $response = $this->apply(body: ['cover_letter' => '  '.self::LETTER.'  ', 'caretaker_notes' => ' Walks twice a day. '])
            ->assertCreated()
            ->assertJsonPath('data.status', 'sent')
            // Trimmed before it is stored (SEC-INPUT-06).
            ->assertJsonPath('data.cover_letter', self::LETTER)
            ->assertJsonPath('data.caretaker_notes', 'Walks twice a day.')
            ->assertJsonPath('data.pet.name', 'Mochi')
            ->assertJsonPath('data.home_profile.full_name', 'Ana Santos')
            ->assertJsonPath('data.home_profile.home_type', 'condo')
            ->assertJsonPath('data.home_profile.household_members', ['partner'])
            ->assertJsonPath('data.sent_at', now()->toISOString())
            // 14 days to answer (§5.3).
            ->assertJsonPath('data.expires_at', now()->addDays(14)->toISOString())
            ->assertJsonPath('meta.open_requests', 1)
            ->assertJsonPath('meta.max_open_requests', 3)
            // The home is named by its public summary: the address and the phone number stay private (SEC-PRIV-02).
            ->assertJsonMissingPath('data.home_profile.contact_number')
            ->assertJsonMissingPath('data.home_profile.street_address');

        $request = AdoptionRequest::query()->sole();
        $this->assertSame($response->json('data.id'), $request->id);
        $this->assertSame($this->pet->id, $request->pet_id);
        $this->assertSame($this->home->id, $request->home_profile_id);

        $notification = $this->human->notifications()->sole();
        $this->assertSame('request_received', $notification->type);
        $this->assertSame("/requests/{$request->id}", $notification->action_url);

        $this->assertSame(1, ActivityLog::query()->where('action', 'adoption_request_sent')->where('actor_user_id', $this->petUser->id)->count());

        // The same call with the home in the body.
        $other = $this->listedHome('Paolo Garcia');
        $this->actingAs($this->petUser)->postJson('/api/v1/adoption-requests', ['home_profile_id' => $other->id, 'cover_letter' => self::LETTER])
            ->assertCreated()
            ->assertJsonPath('data.home_profile.full_name', 'Paolo Garcia')
            ->assertJsonPath('data.caretaker_notes', null)
            ->assertJsonPath('meta.open_requests', 2);
    }

    public function test_the_body_cannot_choose_the_pet_the_status_or_the_dates(): void
    {
        $otherPet = Pet::factory()->for(User::factory()->pet()->active())->lookingForAHome()->create();
        $elsewhere = $this->listedHome('Elsewhere');

        $this->apply(body: [
            'pet_id' => $otherPet->id,
            'status' => 'approved',
            'approved_at' => '2026-01-01T00:00:00Z',
            'expires_at' => '2030-01-01T00:00:00Z',
            // The home in the path wins over one in the body.
            'home_profile_id' => $elsewhere->id,
        ])->assertCreated()->assertJsonPath('data.status', 'sent')->assertJsonPath('data.approved_at', null);

        $request = AdoptionRequest::query()->sole();
        $this->assertSame($this->pet->id, $request->pet_id);
        $this->assertSame($this->home->id, $request->home_profile_id);
        $this->assertTrue($request->expires_at->isBefore(now()->addDays(15)));
    }

    public function test_the_cover_letter_and_the_notes_are_checked(): void
    {
        $letter = 'Write between 50 and 600 characters.';

        $this->actingAs($this->petUser)->postJson($this->applyUrl())->assertUnprocessable()->assertJsonPath('errors.cover_letter.0', $letter);
        $this->apply(body: ['cover_letter' => str_repeat('a', 49)])->assertUnprocessable()->assertJsonPath('errors.cover_letter.0', $letter);
        // Spaces around it don't count toward the 50.
        $this->apply(body: ['cover_letter' => str_repeat(' ', 20).str_repeat('a', 49)])->assertUnprocessable();
        $this->apply(body: ['cover_letter' => str_repeat('a', 601)])->assertUnprocessable()->assertJsonPath('errors.cover_letter.0', $letter);
        $this->apply(body: ['cover_letter' => ['an', 'array']])->assertUnprocessable();
        $this->apply(body: ['caretaker_notes' => str_repeat('a', 601)])
            ->assertUnprocessable()
            ->assertJsonPath('errors.caretaker_notes.0', 'Keep the notes to 600 characters or fewer.');
        $this->actingAs($this->petUser)->postJson('/api/v1/adoption-requests', ['cover_letter' => self::LETTER])
            ->assertUnprocessable()
            ->assertJsonPath('errors.home_profile_id.0', 'Choose a home to apply to.');

        $this->assertSame(0, AdoptionRequest::query()->count());

        // The two ends of the range are both fine.
        $this->apply(body: ['cover_letter' => str_repeat('a', 50)])->assertCreated();
        $this->apply($this->listedHome('Long letter'), ['cover_letter' => str_repeat('a', 600), 'caretaker_notes' => str_repeat('b', 600)])->assertCreated();
    }

    public function test_a_home_the_pet_may_not_open_answers_like_one_that_does_not_exist(): void
    {
        $suspended = HomeProfile::factory()->for(User::factory()->human()->suspended())->openToAdopt()->create(['full_name' => 'Hidden Account']);
        $closed = HomeProfile::factory()->for(User::factory()->human()->active())->create(['full_name' => 'Closed Door']);

        $this->actingAs($this->petUser)->postJson('/api/v1/home-profiles/999999/adoption-requests', ['cover_letter' => self::LETTER])->assertNotFound();
        $this->apply($suspended)->assertNotFound();

        // Open to Adopt is off and the pet has nothing to do with this home: the answer mustn't say whose it is.
        $answer = $this->apply($closed)->assertNotFound();
        $this->assertStringNotContainsString('Closed Door', $answer->getContent());

        $this->assertSame(0, AdoptionRequest::query()->count());
    }

    public function test_a_home_that_turned_open_to_adopt_off_refuses_a_pet_it_invited(): void
    {
        $closed = HomeProfile::factory()->for(User::factory()->human()->active())->create(['full_name' => 'Closed Door']);
        Invite::factory()->create(['home_profile_id' => $closed->id, 'pet_id' => $this->pet->id]);

        // The pet may open this home (it was invited), so it is told why it can't apply.
        $this->apply($closed)->assertConflict()->assertJsonPath('code', 'not_open_to_adopt');
        $this->assertSame(0, AdoptionRequest::query()->count());
    }

    public function test_one_open_request_per_home(): void
    {
        $this->sent($this->home);

        $this->apply()->assertConflict()->assertJsonPath('code', 'request_already_open');
        $this->assertSame(1, AdoptionRequest::query()->count());

        // One that ended without a cooldown doesn't stand in the way.
        AdoptionRequest::query()->update(['status' => 'withdrawn', 'closed_at' => now()]);
        $this->apply()->assertCreated();
    }

    public function test_no_more_than_three_open_requests(): void
    {
        $first = $this->sent($this->listedHome('One'));
        $this->sent($this->listedHome('Two'));
        $this->sent($this->listedHome('Three'));

        $this->apply()->assertConflict()->assertJsonPath('code', 'open_request_limit');
        $this->assertSame(3, AdoptionRequest::query()->count());

        // Withdrawing one frees its place.
        $this->actingAs($this->petUser)->postJson("/api/v1/adoption-requests/{$first->id}/withdraw")->assertOk();
        $this->apply()->assertCreated()->assertJsonPath('meta.open_requests', 3);
    }

    public function test_a_pet_in_process_neither_applies_nor_is_invited_but_one_that_is_only_applying_is(): void
    {
        $waiting = $this->sent($this->listedHome('Waiting'));
        $inviting = $this->listedHome('Inviting');

        // Only applying: a Sent request stops nothing (agreed 2026-10-08).
        $this->apply()->assertCreated();
        $this->actingAs($inviting->user)->postJson("/api/v1/pets/{$this->pet->id}/invites")->assertCreated();

        // A human approves one: the pet is In Process.
        $this->actingAs($waiting->homeProfile->user)->postJson("/api/v1/adoption-requests/{$waiting->id}/approve")->assertOk();
        $this->assertSame(PetStatus::InProcess, $this->pet->fresh()->getStatusEnum());

        $this->apply($this->listedHome('Too late'))->assertConflict()->assertJsonPath('code', 'pet_in_process');
        $this->actingAs($this->listedHome('Also too late')->user)->postJson("/api/v1/pets/{$this->pet->id}/invites")
            ->assertConflict()->assertJsonPath('code', 'pet_not_looking_for_home');

        $this->assertSame(2, AdoptionRequest::query()->count());
        $this->assertSame(1, Invite::query()->count());
    }

    public function test_a_pet_waits_thirty_days_after_a_decline(): void
    {
        $this->sent($this->home, 'declined', ['closed_at' => now()->subDays(29)]);
        $notAdopted = $this->listedHome('Not adopted');
        $this->sent($notAdopted, null, ['status' => 'not_adopted', 'closed_at' => now()->subDays(2)]);

        $this->apply()->assertConflict()->assertJsonPath('code', 'request_cooldown');
        $this->apply($notAdopted)->assertConflict()->assertJsonPath('code', 'request_cooldown');

        // On day 31 the wait is over.
        $this->travel(2)->days();
        $this->apply()->assertCreated();
    }

    public function test_a_draft_or_an_adopted_pet_does_not_apply(): void
    {
        $this->pet->forceFill(['status' => PetStatus::Draft->value])->save();
        $this->apply()->assertConflict()
            ->assertJsonPath('code', 'pet_resume_draft')
            ->assertJsonPath('message', 'Publish your resume before you send an adoption request.');

        $this->pet->forceFill(['status' => PetStatus::AdoptedHired->value])->save();
        $this->apply()->assertConflict()->assertJsonPath('code', 'already_adopted');

        $this->assertSame(0, AdoptionRequest::query()->count());
    }

    public function test_my_requests_lists_the_pets_own_by_tab_with_the_count_of_each_status(): void
    {
        $sent = $this->sent($this->home, null, ['sent_at' => '2026-10-03 09:00:00']);
        $onHold = $this->sent($this->listedHome('On hold'), 'onHold', ['sent_at' => '2026-10-02 09:00:00']);
        $declined = $this->sent($this->listedHome('Declined'), 'declined', ['sent_at' => '2026-10-01 09:00:00']);
        $withdrawn = $this->sent($this->listedHome('Withdrawn'), 'withdrawn', ['sent_at' => '2026-09-30 09:00:00']);

        // Another pet's request to the same home is not Mochi's to see.
        $otherPetUser = User::factory()->pet()->active()->create();
        $otherPet = Pet::factory()->for($otherPetUser)->lookingForAHome()->create();
        AdoptionRequest::factory()->create(['pet_id' => $otherPet->id, 'home_profile_id' => $this->home->id]);

        $this->actingAs($this->petUser)->getJson('/api/v1/adoption-requests?tab=active')
            ->assertOk()
            ->assertJsonPath('meta.total', 2)
            // Newest sent first.
            ->assertJsonPath('data.0.id', $sent->id)
            ->assertJsonPath('data.1.id', $onHold->id)
            ->assertJsonPath('data.0.home_profile.full_name', 'Ana Santos')
            ->assertJsonPath('data.0.home_profile.home_type', 'condo')
            ->assertJsonPath('data.0.home_profile.household_members', [])
            // Every status is counted, whatever the tab.
            ->assertJsonCount(4, 'meta.status_counts')
            ->assertJsonPath('meta.status_counts.sent', 1)
            ->assertJsonPath('meta.status_counts.on_hold', 1)
            ->assertJsonPath('meta.status_counts.declined', 1)
            ->assertJsonPath('meta.status_counts.withdrawn', 1)
            ->assertJsonMissingPath('data.0.home_profile.contact_number')
            ->assertJsonMissingPath('data.0.home_profile.street_address')
            // The private details of a confirmed Meet & Greet belong to the request's own page.
            ->assertJsonMissingPath('data.0.contacts');

        $this->actingAs($this->petUser)->getJson('/api/v1/adoption-requests?tab=closed')
            ->assertOk()
            ->assertJsonPath('meta.total', 2)
            ->assertJsonPath('data.0.id', $declined->id)
            ->assertJsonPath('data.1.id', $withdrawn->id);

        $this->actingAs($this->petUser)->getJson('/api/v1/adoption-requests')->assertOk()->assertJsonPath('meta.total', 4);
        $this->actingAs($this->petUser)->getJson('/api/v1/adoption-requests?status=sent,declined')->assertOk()->assertJsonPath('meta.total', 2);
        $this->actingAs($this->petUser)->getJson('/api/v1/adoption-requests?per_page=1&page=2')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('meta.last_page', 4);
        $this->actingAs($this->petUser)->getJson('/api/v1/adoption-requests?per_page=500')->assertOk()->assertJsonPath('meta.per_page', 50);

        // The human on the other side reads what was sent to their home, and nothing else.
        $this->actingAs($this->human)->getJson('/api/v1/adoption-requests?tab=new')
            ->assertOk()
            ->assertJsonPath('meta.total', 2)
            ->assertJsonPath('meta.status_counts', ['sent' => 2]);

        // A pet with nothing sent yet.
        $this->actingAs($otherPetUser)->getJson('/api/v1/adoption-requests?tab=closed')->assertOk()->assertJsonPath('meta.total', 0);
    }

    public function test_the_list_accepts_only_known_tabs_statuses_and_pages(): void
    {
        $this->actingAs($this->petUser)->getJson('/api/v1/adoption-requests?tab=everything')->assertUnprocessable()->assertJsonValidationErrors('tab');
        $this->actingAs($this->petUser)->getJson('/api/v1/adoption-requests?status=sent,hired')->assertUnprocessable();
        $this->actingAs($this->petUser)->getJson('/api/v1/adoption-requests?page=0')->assertUnprocessable()->assertJsonValidationErrors('page');

        // No requests at all: an empty page, and no counts.
        $this->actingAs($this->petUser)->getJson('/api/v1/adoption-requests?tab=active')
            ->assertOk()->assertJsonPath('meta.total', 0)->assertJsonPath('meta.status_counts', []);
    }

    public function test_a_request_is_read_by_its_two_sides_and_admins_only(): void
    {
        $request = $this->sent($this->home, null, ['cover_letter' => self::LETTER]);
        MatchScore::factory()->create(['pet_id' => $this->pet->id, 'home_profile_id' => $this->home->id, 'score' => 86]);

        $this->actingAs($this->petUser)->getJson("/api/v1/adoption-requests/{$request->id}")
            ->assertOk()
            ->assertJsonPath('data.id', $request->id)
            ->assertJsonPath('data.status', 'sent')
            ->assertJsonPath('data.cover_letter', self::LETTER)
            ->assertJsonPath('data.home_profile.full_name', 'Ana Santos')
            ->assertJsonPath('data.match_score', 86)
            ->assertJsonPath('data.cooldown_until', null)
            ->assertJsonMissingPath('data.is_thread_open')
            // Nothing private before a Meet & Greet is confirmed (SEC-PRIV-02).
            ->assertJsonPath('data.contact_unlocked', false)
            ->assertJsonPath('data.contacts', null);

        $this->actingAs($this->human)->getJson("/api/v1/adoption-requests/{$request->id}")->assertOk();
        $this->actingAs(User::factory()->admin()->create())->getJson("/api/v1/adoption-requests/{$request->id}")->assertOk();

        // Anyone else is answered like a request that doesn't exist (SEC-AUTHZ-04).
        $otherPetUser = User::factory()->pet()->active()->create();
        Pet::factory()->for($otherPetUser)->lookingForAHome()->create();
        $this->actingAs($otherPetUser)->getJson("/api/v1/adoption-requests/{$request->id}")->assertNotFound();
        $this->actingAs($this->listedHome('Someone else')->user)->getJson("/api/v1/adoption-requests/{$request->id}")->assertNotFound();
        $this->actingAs($this->petUser)->getJson('/api/v1/adoption-requests/999999')->assertNotFound();
    }

    public function test_a_declined_request_says_why_and_when_the_pet_may_apply_again(): void
    {
        $this->freezeSecond();
        $request = $this->sent($this->home, 'declined', [
            'decline_reason' => 'another_pet_joining',
            'decision_message' => 'Thank you, Mochi. We are welcoming another dog this month.',
            'closed_at' => now()->subDays(8),
        ]);

        $this->actingAs($this->petUser)->getJson("/api/v1/adoption-requests/{$request->id}")
            ->assertOk()
            ->assertJsonPath('data.status', 'declined')
            ->assertJsonPath('data.decline_reason', 'another_pet_joining')
            ->assertJsonPath('data.decision_message', 'Thank you, Mochi. We are welcoming another dog this month.')
            ->assertJsonPath('data.cooldown_until', now()->addDays(22)->toISOString());

        // Once the 30 days are over there is nothing left to wait for.
        $this->travel(23)->days();
        $this->actingAs($this->petUser)->getJson("/api/v1/adoption-requests/{$request->id}")->assertOk()->assertJsonPath('data.cooldown_until', null);
    }

    public function test_a_pet_withdraws_a_request_and_the_human_is_told(): void
    {
        $this->freezeSecond();
        $request = $this->sent($this->home);

        $this->actingAs($this->petUser)->postJson("/api/v1/adoption-requests/{$request->id}/withdraw", ['withdraw_reason' => 'found_better_match'])
            ->assertOk()
            ->assertJsonPath('data.status', 'withdrawn')
            ->assertJsonPath('data.withdraw_reason', 'found_better_match')
            ->assertJsonPath('data.closed_at', now()->toISOString())
            ->assertJsonPath('data.expires_at', null);

        $this->assertSame('withdrawn', $request->fresh()->status);
        $this->assertSame(PetStatus::LookingForAHome, $this->pet->fresh()->getStatusEnum());
        $this->assertSame(1, $this->human->notifications()->count());
        $this->assertSame(1, ActivityLog::query()->where('action', 'adoption_request_withdrawn')->where('actor_user_id', $this->petUser->id)->count());

        // It can't be withdrawn twice.
        $this->actingAs($this->petUser)->postJson("/api/v1/adoption-requests/{$request->id}/withdraw")
            ->assertConflict()->assertJsonPath('code', 'request_already_closed');
    }

    public function test_the_reason_for_withdrawing_is_optional_and_from_the_list(): void
    {
        $request = $this->sent($this->home);
        $url = "/api/v1/adoption-requests/{$request->id}/withdraw";

        $this->actingAs($this->petUser)->postJson($url, ['withdraw_reason' => 'changed_my_mind'])
            ->assertUnprocessable()
            ->assertJsonPath('errors.withdraw_reason.0', 'Choose a reason from the list, or leave it out.');
        $this->assertSame('sent', $request->fresh()->status);

        // No choice made, sent as an empty value.
        $this->actingAs($this->petUser)->postJson($url, ['withdraw_reason' => ''])->assertOk()->assertJsonPath('data.withdraw_reason', null);
    }

    public function test_withdrawing_the_request_in_process_frees_the_pet_and_its_requests_on_hold(): void
    {
        $this->freezeSecond();
        $inProcess = $this->sent($this->home, 'approved');
        $paused = $this->sent($this->listedHome('Paused'), 'onHold', ['sent_at' => '2026-09-21 09:00:00', 'expires_at' => null]);
        $this->pet->forceFill(['status' => PetStatus::InProcess->value])->save();

        $this->actingAs($this->petUser)->postJson("/api/v1/adoption-requests/{$inProcess->id}/withdraw")->assertOk()->assertJsonPath('data.status', 'withdrawn');

        $this->assertSame(PetStatus::LookingForAHome, $this->pet->fresh()->getStatusEnum());

        // Back to Sent with a fresh 14 days, and still dated the day the pet sent it.
        $paused->refresh();
        $this->assertSame('sent', $paused->status);
        $this->assertTrue($paused->expires_at->equalTo(now()->addDays(14)));
        $this->assertSame('2026-09-21 09:00:00', $paused->sent_at->format('Y-m-d H:i:s'));
    }

    public function test_only_the_pet_that_sent_it_withdraws(): void
    {
        $request = $this->sent($this->home);
        $url = "/api/v1/adoption-requests/{$request->id}/withdraw";

        $otherPetUser = User::factory()->pet()->active()->create();
        Pet::factory()->for($otherPetUser)->lookingForAHome()->create();

        // Each is answered like a request that doesn't exist, the human it was sent to included (SEC-AUTHZ-04).
        $this->actingAs($otherPetUser)->postJson($url)->assertNotFound();
        $this->actingAs($this->human)->postJson($url)->assertNotFound();
        $this->actingAs(User::factory()->admin()->create())->postJson($url)->assertNotFound();
        $this->actingAs($this->petUser)->postJson('/api/v1/adoption-requests/999999/withdraw')->assertNotFound();

        $this->assertSame('sent', $request->fresh()->status);
    }
}
