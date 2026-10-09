<?php

declare(strict_types=1);

namespace Tests\Feature\Adoption;

use App\Enums\PetStatus;
use App\Models\ActivityLog;
use App\Models\Adoption;
use App\Models\AdoptionRequest;
use App\Models\HomeProfile;
use App\Models\MatchScore;
use App\Models\MeetAndGreet;
use App\Models\MeetGreetSlot;
use App\Models\NotificationPreference;
use App\Models\Pet;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The decision after a Meet & Greet, and the adoption it can end in (MG-11…MG-14, AL-01…AL-06, FR12, FR13, FR14,
 * FR28, docs/api/adoption-and-meet-greet.md): once the meeting time has passed, the human adopts, declines, or
 * reports that the meeting didn't happen. Adopting links the pet to its one Furparent for good and closes its other
 * requests. Only the human a request was sent to decides, and only the two sides and admins read the adoption record.
 */
class AdoptionDecisionTest extends TestCase
{
    use RefreshDatabase;

    private User $human;

    private HomeProfile $home;

    private User $petUser;

    private Pet $pet;

    private AdoptionRequest $request;

    private MeetGreetSlot $slot;

    private MeetAndGreet $meeting;

    protected function setUp(): void
    {
        parent::setUp();

        $this->human = User::factory()->human()->active()->create();
        $this->home = HomeProfile::factory()->for($this->human)->openToAdopt()->create([
            'full_name' => 'Ana Santos',
            'city' => 'Quezon City',
            'contact_number' => '09170000001',
            'street_address' => '12 Sample St., Brgy. Example',
        ]);

        $this->petUser = User::factory()->pet()->active()->create();
        $this->pet = Pet::factory()->for($this->petUser)->lookingForAHome()->create([
            'name' => 'Mochi',
            'status' => 'in_process',
            'caretaker_name' => 'Liza Reyes',
            'caretaker_contact_number' => '09180000002',
        ]);

        // Mochi's Meet & Greet with Ana is confirmed, three days from now.
        $this->request = AdoptionRequest::factory()->meetScheduled()->create([
            'pet_id' => $this->pet->id,
            'home_profile_id' => $this->home->id,
            'cover_letter' => 'I am calm indoors and love long walks, which sounds just like your weekends.',
            'sent_at' => now()->subDays(5),
            'approved_at' => now()->subDays(3),
            'meet_scheduled_at' => now()->subDays(2),
            'expires_at' => null,
        ]);
        $this->slot = MeetGreetSlot::factory()->create([
            'home_profile_id' => $this->home->id,
            'starts_at' => now()->addDays(3),
            'place_details' => 'UP Diliman Academic Oval',
        ]);
        $this->meeting = MeetAndGreet::factory()->confirmed()->create([
            'adoption_request_id' => $this->request->id,
            'meet_greet_slot_id' => $this->slot->id,
        ]);
    }

    /**
     * The meeting time goes by. With `$jobRan` the scheduled job has moved the request to Awaiting Decision and ended
     * the booking, as it does within fifteen minutes; without it the request is still Meet Scheduled.
     */
    private function meetingTimePasses(bool $jobRan = true): void
    {
        $this->slot->forceFill(['starts_at' => now()->subHours(3)])->save();

        if ($jobRan) {
            $this->meeting->forceFill(['status' => 'ended', 'ended_at' => now()->subHours(3)])->save();
            $this->request->forceFill(['status' => 'awaiting_decision', 'awaiting_decision_at' => now()->subHours(3)])->save();
        }
    }

    /** Another of Mochi's requests, paused while the one with Ana is in process. */
    private function requestOnHold(string $homeName = 'Paolo Garcia'): AdoptionRequest
    {
        $home = HomeProfile::factory()->for(User::factory()->human()->active())->openToAdopt()->create(['full_name' => $homeName]);

        return AdoptionRequest::factory()->onHold()->create([
            'pet_id' => $this->pet->id,
            'home_profile_id' => $home->id,
            'sent_at' => now()->subDays(6),
            'expires_at' => null,
        ]);
    }

    private function url(string $action): string
    {
        return "/api/v1/adoption-requests/{$this->request->id}/{$action}";
    }

    public function test_a_request_says_when_the_meeting_time_has_passed(): void
    {
        $detail = "/api/v1/adoption-requests/{$this->request->id}";

        $this->actingAs($this->human)->getJson($detail)
            ->assertOk()
            ->assertJsonPath('data.status', 'meet_scheduled')
            ->assertJsonPath('data.meeting_passed', false)
            ->assertJsonPath('data.adoption', null);

        // Its time is behind us, though the job hasn't moved the status yet: the decision is already open.
        $this->meetingTimePasses(jobRan: false);
        $this->actingAs($this->human)->getJson($detail)
            ->assertOk()
            ->assertJsonPath('data.status', 'meet_scheduled')
            ->assertJsonPath('data.meeting_passed', true);

        $this->meetingTimePasses();
        foreach ([$this->human, $this->petUser] as $side) {
            $this->actingAs($side)->getJson($detail)
                ->assertOk()
                ->assertJsonPath('data.status', 'awaiting_decision')
                ->assertJsonPath('data.meeting_passed', true)
                // The two sides can still reach each other while the decision is open (SEC-PRIV-02).
                ->assertJsonPath('data.contact_unlocked', true)
                ->assertJsonPath('data.latest_meet_and_greet.slot.place_details', 'UP Diliman Academic Oval');
        }
    }

    public function test_adopting_makes_the_pet_hired_the_human_a_furparent_and_closes_the_pets_other_requests(): void
    {
        $this->freezeSecond();
        $this->meetingTimePasses();
        $paused = $this->requestOnHold();
        // A request that already ended stays as it is.
        $ended = AdoptionRequest::factory()->declined()->create(['pet_id' => $this->pet->id]);
        MatchScore::factory()->create(['pet_id' => $this->pet->id, 'home_profile_id' => $paused->home_profile_id]);

        $adoptionId = $this->actingAs($this->human)->postJson($this->url('adopt'))
            ->assertOk()
            // The request itself, like every other answer, now Adopted and carrying its adoption (AL-04).
            ->assertJsonPath('data.id', $this->request->id)
            ->assertJsonPath('data.status', 'adopted')
            ->assertJsonPath('data.closed_at', now()->toISOString())
            ->assertJsonPath('data.adoption.adopted_at', now()->toISOString())
            ->assertJsonPath('data.meeting_passed', false)
            ->assertJsonPath('data.pet.status', 'adopted_hired')
            ->assertJsonPath('data.home_profile.is_furparent', true)
            // The two sides keep each other's details to arrange the handover.
            ->assertJsonPath('data.contacts.caretaker_contact_number', '09180000002')
            ->json('data.adoption.id');

        // Nobody set any of this by hand (FR27): the pet is Hired, and linked to its one Furparent.
        $this->assertSame(PetStatus::AdoptedHired, $this->pet->fresh()->getStatusEnum());
        $adoption = Adoption::query()->sole();
        $this->assertSame($adoptionId, $adoption->id);
        $this->assertSame([$this->pet->id, $this->home->id, $this->request->id], [$adoption->pet_id, $adoption->home_profile_id, $adoption->adoption_request_id]);

        $home = $this->home->fresh();
        $this->assertTrue($home->isFurparent());
        $this->assertFalse($home->isOpenToAdopt());

        // The pet's other open requests close (FR28), and their humans are told.
        $paused->refresh();
        $this->assertSame('closed', $paused->status);
        $this->assertNotNull($paused->closed_at);
        $this->assertSame("{$this->pet->name} has been adopted", $paused->homeProfile->user->notifications()->sole()->title);
        $this->assertSame('declined', $ended->fresh()->status);

        // Alumni leave search and matches (§5.5), and say so on the feed themselves.
        $this->assertSame(0, MatchScore::query()->where('pet_id', $this->pet->id)->count());
        $this->assertSame('hired', Post::query()->where('adopted_pet_id', $this->pet->id)->sole()->type);

        $told = $this->petUser->notifications()->sole();
        $this->assertSame('You got Hired!', $told->title);
        $this->assertStringContainsString('Ana Santos adopted you', $told->body);
        $this->assertSame("/requests/{$this->request->id}", $told->action_url);

        // Every change of status is on the record, with who made it (SEC-LOG-01).
        $this->assertSame(1, ActivityLog::query()->where('action', 'adoption_confirmed')->where('actor_user_id', $this->human->id)->count());
        $this->assertSame(1, ActivityLog::query()->where('action', 'pet_adopted_hired')->where('after_value', 'adopted_hired')->count());
        $this->assertSame(1, ActivityLog::query()->where('action', 'adoption_request_closed')->where('subject_id', $paused->id)->count());

        // The resume is an alumni profile now, linked to the Furparent (AL-05).
        $this->actingAs($this->human)->getJson("/api/v1/pets/{$this->pet->id}")
            ->assertOk()
            ->assertJsonPath('data.status', 'adopted_hired')
            ->assertJsonPath('data.hired_by.adoption_id', $adoptionId)
            ->assertJsonPath('data.hired_by.home_profile_id', $this->home->id);

        // It can't be decided twice.
        $this->actingAs($this->human)->postJson($this->url('adopt'))->assertConflict()->assertJsonPath('code', 'invalid_request_state');
        $this->actingAs($this->human)->postJson($this->url('decline-after-meeting'))->assertConflict()->assertJsonPath('code', 'invalid_request_state');
        $this->assertSame(1, Adoption::query()->count());
    }

    public function test_a_decision_opens_only_once_the_meeting_time_has_passed(): void
    {
        // Confirmed, and still ahead (NFR3).
        foreach (['adopt' => [], 'decline-after-meeting' => [], 'meet-and-greet/didnt-happen' => ['reason' => 'other']] as $action => $body) {
            $this->actingAs($this->human)->postJson($this->url($action), $body)
                ->assertConflict()
                ->assertJsonPath('code', 'meeting_not_yet_passed');
        }

        // Not at a meeting at all: approved, with nothing confirmed.
        $this->meeting->forceFill(['status' => 'ended', 'ended_at' => now(), 'end_reason' => 'schedule_conflict'])->save();
        $this->request->forceFill(['status' => 'approved', 'meet_scheduled_at' => null])->save();
        foreach (['adopt' => [], 'decline-after-meeting' => [], 'meet-and-greet/didnt-happen' => ['reason' => 'other']] as $action => $body) {
            $this->actingAs($this->human)->postJson($this->url($action), $body)
                ->assertConflict()
                ->assertJsonPath('code', 'invalid_request_state');
        }

        $this->assertSame('approved', $this->request->fresh()->status);
        $this->assertSame(PetStatus::InProcess, $this->pet->fresh()->getStatusEnum());
        $this->assertSame(0, Adoption::query()->count());
    }

    public function test_the_human_can_decide_before_the_job_has_moved_the_request(): void
    {
        $this->meetingTimePasses(jobRan: false);

        $this->actingAs($this->human)->postJson($this->url('adopt'))
            ->assertOk()
            ->assertJsonPath('data.status', 'adopted')
            // The booking that was still standing ended with the decision; nobody called it off.
            ->assertJsonPath('data.active_meet_and_greet', null)
            ->assertJsonPath('data.latest_meet_and_greet.status', 'ended')
            ->assertJsonPath('data.latest_meet_and_greet.ended_by', null)
            ->assertJsonPath('data.latest_meet_and_greet.end_reason', null);

        $this->assertSame(PetStatus::AdoptedHired, $this->pet->fresh()->getStatusEnum());
    }

    public function test_a_pet_is_adopted_only_once(): void
    {
        $this->meetingTimePasses();
        // An adoption written by another path, such as an admin's resolution (AL-07).
        Adoption::factory()->create(['pet_id' => $this->pet->id]);

        $this->actingAs($this->human)->postJson($this->url('adopt'))
            ->assertConflict()
            ->assertJsonPath('code', 'already_adopted');

        $this->assertSame('awaiting_decision', $this->request->fresh()->status);
        $this->assertSame(1, Adoption::query()->count());
    }

    public function test_declining_after_the_meeting_frees_the_pet_and_starts_the_thirty_day_wait(): void
    {
        $this->freezeSecond();
        $this->meetingTimePasses();
        $paused = $this->requestOnHold();

        $this->actingAs($this->human)->postJson($this->url('decline-after-meeting'), ['decision_message' => '  Thank you for bringing Mochi.  '])
            ->assertOk()
            ->assertJsonPath('data.status', 'not_adopted')
            // Trimmed before it is stored (SEC-INPUT-06).
            ->assertJsonPath('data.decision_message', 'Thank you for bringing Mochi.')
            ->assertJsonPath('data.decline_reason', null)
            ->assertJsonPath('data.closed_at', now()->toISOString())
            ->assertJsonPath('data.cooldown_until', now()->addDays(30)->toISOString())
            ->assertJsonPath('data.adoption', null)
            // Nothing private stays behind (SEC-PRIV-02).
            ->assertJsonPath('data.contact_unlocked', false)
            ->assertJsonPath('data.contacts', null);

        // Looking for a Home again, with its paused request back to Sent and a fresh 14 days (§5.3).
        $this->assertSame(PetStatus::LookingForAHome, $this->pet->fresh()->getStatusEnum());
        $paused->refresh();
        $this->assertSame('sent', $paused->status);
        $this->assertTrue($paused->expires_at->equalTo(now()->addDays(14)));
        $this->assertFalse($this->home->fresh()->isFurparent());
        $this->assertSame(0, Adoption::query()->count());

        $told = $this->petUser->notifications()->sole();
        $this->assertSame('Ana Santos decided not to adopt', $told->title);
        $this->assertSame(1, ActivityLog::query()->where('action', 'adoption_request_not_adopted')->where('actor_user_id', $this->human->id)->count());

        // The pet can't apply to this home again for 30 days (§5.5).
        $this->actingAs($this->petUser)->postJson("/api/v1/home-profiles/{$this->home->id}/adoption-requests", [
            'cover_letter' => 'I would still love to join your home, and I am happy to meet again whenever you like.',
        ])->assertConflict()->assertJsonPath('code', 'request_cooldown');
    }

    public function test_the_message_and_the_reason_of_a_decision_are_optional_and_checked(): void
    {
        $this->meetingTimePasses();

        $this->actingAs($this->human)->postJson($this->url('decline-after-meeting'), ['decline_reason' => 'because', 'decision_message' => str_repeat('a', 601)])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['decline_reason', 'decision_message']);
        $this->actingAs($this->human)->postJson($this->url('adopt'), ['decision_message' => str_repeat('a', 601)])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['decision_message']);
        $this->assertSame('awaiting_decision', $this->request->fresh()->status);

        // The status and its dates are the system's: sent along, they are ignored (SEC-INPUT-04, FR27).
        $this->actingAs($this->human)->postJson($this->url('decline-after-meeting'), ['decline_reason' => 'not_right_fit', 'status' => 'adopted', 'closed_at' => '2020-01-01'])
            ->assertOk()
            ->assertJsonPath('data.status', 'not_adopted')
            ->assertJsonPath('data.decline_reason', 'not_right_fit')
            ->assertJsonPath('data.decision_message', null);
        $this->assertTrue($this->request->fresh()->closed_at->isToday());
    }

    public function test_reporting_that_the_meeting_didnt_happen_reopens_booking(): void
    {
        $this->freezeSecond();
        $this->meetingTimePasses();
        $this->request->forceFill(['overdue_flagged_at' => now()])->save();
        $paused = $this->requestOnHold();
        $url = $this->url('meet-and-greet/didnt-happen');

        // What happened is always said, and is one of the four the dialog lists; a cancel reason isn't one.
        $this->actingAs($this->human)->postJson($url, [])->assertUnprocessable()->assertJsonValidationErrors(['reason']);
        $this->actingAs($this->human)->postJson($url, ['reason' => 'schedule_conflict'])->assertUnprocessable()->assertJsonValidationErrors(['reason']);
        $this->actingAs($this->human)->postJson($url, ['reason' => 'other', 'details' => str_repeat('a', 601)])->assertUnprocessable()->assertJsonValidationErrors(['details']);

        $this->actingAs($this->human)->postJson($url, ['reason' => 'didnt_show_pet_side', 'details' => '  We waited for an hour.  '])
            ->assertOk()
            // Approved again, with a fresh 14 days to book (§5.4).
            ->assertJsonPath('data.status', 'approved')
            ->assertJsonPath('data.expires_at', now()->addDays(14)->toISOString())
            ->assertJsonPath('data.meet_scheduled_at', null)
            ->assertJsonPath('data.awaiting_decision_at', null)
            ->assertJsonPath('data.overdue_flagged_at', null)
            ->assertJsonPath('data.meeting_passed', false)
            ->assertJsonPath('data.active_meet_and_greet', null)
            ->assertJsonPath('data.latest_meet_and_greet.ended_by', 'human')
            ->assertJsonPath('data.latest_meet_and_greet.end_reason', 'didnt_show_pet_side')
            ->assertJsonPath('data.latest_meet_and_greet.end_details', 'We waited for an hour.')
            ->assertJsonPath('data.contact_unlocked', false)
            ->assertJsonPath('data.contacts', null);

        // The request goes on: the pet stays In Process and its other request stays paused.
        $this->assertSame(PetStatus::InProcess, $this->pet->fresh()->getStatusEnum());
        $this->assertSame('on_hold', $paused->fresh()->status);

        $told = $this->petUser->notifications()->sole();
        $this->assertSame('meet_greet_cancelled', $told->type);
        $this->assertStringContainsString("The pet's side didn't show up", $told->body);

        $this->assertSame(1, ActivityLog::query()->where('action', 'meet_and_greet_didnt_happen')->where('actor_user_id', $this->human->id)->count());
        $this->assertSame(1, ActivityLog::query()->where('action', 'adoption_request_booking_reopened')->where('before_value', 'awaiting_decision')->count());

        // Nothing is left to report or to decide until a new meeting has taken place.
        $this->actingAs($this->human)->postJson($url, ['reason' => 'other'])->assertConflict()->assertJsonPath('code', 'invalid_request_state');
    }

    public function test_only_the_human_it_was_sent_to_decides(): void
    {
        $this->meetingTimePasses();
        $otherPet = User::factory()->pet()->active()->create();
        Pet::factory()->for($otherPet)->lookingForAHome()->create();
        $otherHuman = User::factory()->human()->active()->create();
        HomeProfile::factory()->for($otherHuman)->openToAdopt()->create();
        $admin = User::factory()->admin()->active()->create();
        $actions = ['adopt' => [], 'decline-after-meeting' => [], 'meet-and-greet/didnt-happen' => ['reason' => 'other']];

        foreach ($actions as $action => $body) {
            // Signed out gets nowhere.
            $this->postJson($this->url($action), $body)->assertUnauthorized();
        }

        foreach ($actions as $action => $body) {
            // Anyone else, the pet that sent it and an admin included, is answered like a request that doesn't
            // exist (SEC-AUTHZ-04).
            foreach ([$this->petUser, $otherPet, $otherHuman, $admin] as $stranger) {
                $this->actingAs($stranger)->postJson($this->url($action), $body)->assertNotFound();
            }
            $this->actingAs($this->human)->postJson("/api/v1/adoption-requests/999999/{$action}", $body)->assertNotFound();
        }

        // An account that isn't Active never gets that far (SEC-AUTHZ-06).
        $suspended = User::factory()->human()->suspended()->create();
        $this->actingAs($suspended)->postJson($this->url('adopt'))->assertForbidden()->assertJsonPath('code', 'account_not_active');

        $this->assertSame('awaiting_decision', $this->request->fresh()->status);
        $this->assertSame(PetStatus::InProcess, $this->pet->fresh()->getStatusEnum());
        $this->assertSame(0, Adoption::query()->count());
    }

    public function test_an_account_that_turned_request_notifications_off_is_not_notified(): void
    {
        $this->meetingTimePasses();
        NotificationPreference::factory()->muted()->create(['user_id' => $this->petUser->id]);

        $this->actingAs($this->human)->postJson($this->url('adopt'))->assertOk();

        $this->assertSame(0, $this->petUser->notifications()->count());
    }

    public function test_the_adoption_record_is_read_by_its_two_sides_and_admins_only(): void
    {
        $this->freezeSecond();
        $this->meetingTimePasses();
        $id = $this->actingAs($this->human)->postJson($this->url('adopt'))->assertOk()->json('data.adoption.id');
        $record = "/api/v1/adoptions/{$id}";

        $this->app['auth']->forgetGuards();
        $this->getJson($record)->assertUnauthorized();

        $admin = User::factory()->admin()->active()->create();
        foreach ([$this->human, $this->petUser, $admin] as $reader) {
            $this->actingAs($reader)->getJson($record)
                ->assertOk()
                ->assertJsonPath('data.id', $id)
                ->assertJsonPath('data.pet.name', 'Mochi')
                ->assertJsonPath('data.home_profile.full_name', 'Ana Santos')
                ->assertJsonPath('data.home_profile.is_furparent', true)
                ->assertJsonPath('data.adoption_request_id', $this->request->id)
                ->assertJsonPath('data.adopted_at', now()->toISOString())
                // Sent five days ago.
                ->assertJsonPath('data.days_to_adoption', 5)
                ->assertJsonPath('data.cover_letter', 'I am calm indoors and love long walks, which sounds just like your weekends.')
                ->assertJsonPath('data.timeline.sent_at', $this->request->sent_at->toISOString())
                ->assertJsonPath('data.timeline.approved_at', $this->request->approved_at->toISOString())
                ->assertJsonPath('data.timeline.adopted_at', now()->toISOString())
                ->assertJsonPath('data.meeting.place_details', 'UP Diliman Academic Oval')
                // The record names where they met, never where anyone lives (SEC-PRIV-02).
                ->assertJsonMissingPath('data.contacts')
                ->assertJsonMissingPath('data.home_profile.street_address');
        }

        // Anyone else is answered like an adoption that doesn't exist (SEC-AUTHZ-03, SEC-AUTHZ-04).
        $otherPet = User::factory()->pet()->active()->create();
        Pet::factory()->for($otherPet)->lookingForAHome()->create();
        $otherHuman = User::factory()->human()->active()->create();
        HomeProfile::factory()->for($otherHuman)->openToAdopt()->create();
        foreach ([$otherPet, $otherHuman] as $stranger) {
            $this->actingAs($stranger)->getJson($record)->assertNotFound();
        }
        $this->actingAs($this->human)->getJson('/api/v1/adoptions/999999')->assertNotFound();

        // Once an admin removes the link (AL-07), the record is the admin's alone.
        Adoption::query()->whereKey($id)->update(['link_removed_at' => now()]);
        foreach ([$this->human, $this->petUser] as $side) {
            $this->actingAs($side)->getJson($record)->assertNotFound();
        }
        $this->actingAs($admin)->getJson($record)->assertOk()->assertJsonPath('data.link_removed_at', now()->toISOString());
    }
}
