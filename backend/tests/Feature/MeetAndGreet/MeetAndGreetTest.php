<?php

declare(strict_types=1);

namespace Tests\Feature\MeetAndGreet;

use App\Models\ActivityLog;
use App\Models\AdoptionRequest;
use App\Models\HomeProfile;
use App\Models\MeetAndGreet;
use App\Models\MeetGreetSlot;
use App\Models\Pet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The Meet & Greet of an approved request (MG-03…MG-10, FR11, FR26, docs/api/adoption-and-meet-greet.md): the pet
 * books one of the home's open slots, the human confirms or proposes another time, either side reschedules or
 * cancels. Contact details open only while a meeting is confirmed (SEC-PRIV-02, NFR4), and only the two sides of a
 * request act on it.
 */
class MeetAndGreetTest extends TestCase
{
    use RefreshDatabase;

    private User $human;

    private HomeProfile $home;

    private User $petUser;

    private Pet $pet;

    private AdoptionRequest $request;

    protected function setUp(): void
    {
        parent::setUp();

        $this->human = User::factory()->human()->active()->create();
        $this->home = HomeProfile::factory()->for($this->human)->openToAdopt()->create([
            'full_name' => 'Ana Santos',
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

        $this->request = AdoptionRequest::factory()->approved()->create(['pet_id' => $this->pet->id, 'home_profile_id' => $this->home->id]);
    }

    private function slot(array $with = [], ?HomeProfile $of = null): MeetGreetSlot
    {
        return MeetGreetSlot::factory()->create([
            'home_profile_id' => ($of ?? $this->home)->id,
            'starts_at' => now()->addDays(3),
            'place_details' => 'UP Diliman Academic Oval',
            ...$with,
        ]);
    }

    /** A booking written straight to the table, as one made earlier. */
    private function booking(MeetGreetSlot $slot, bool $confirmed = false, ?AdoptionRequest $for = null): MeetAndGreet
    {
        $factory = MeetAndGreet::factory();
        $for ??= $this->request;
        if ($confirmed) {
            $for->forceFill(['status' => 'meet_scheduled', 'meet_scheduled_at' => now(), 'expires_at' => null])->save();
        }

        return ($confirmed ? $factory->confirmed() : $factory)->create(['adoption_request_id' => $for->id, 'meet_greet_slot_id' => $slot->id]);
    }

    /** Another pet's approved request with the same home. */
    private function otherRequest(): AdoptionRequest
    {
        $pet = Pet::factory()->for(User::factory()->pet()->active())->lookingForAHome()->create(['name' => 'Pepper']);

        return AdoptionRequest::factory()->approved()->create(['pet_id' => $pet->id, 'home_profile_id' => $this->home->id]);
    }

    private function url(string $action = ''): string
    {
        return "/api/v1/adoption-requests/{$this->request->id}/meet-and-greet".($action === '' ? '' : "/{$action}");
    }

    public function test_a_pet_books_an_open_slot_and_the_human_is_told_in_philippine_time(): void
    {
        // 02:00 UTC is 10:00 in the Philippines.
        $slot = $this->slot(['starts_at' => now()->addDays(3)->setTime(2, 0)]);
        $taken = $this->slot(['starts_at' => now()->addDays(4)]);
        $this->booking($taken, for: $this->otherRequest());

        // Before booking, the request carries the slots that can still be taken, and nothing private.
        $this->actingAs($this->petUser)->getJson("/api/v1/adoption-requests/{$this->request->id}")
            ->assertOk()
            ->assertJsonCount(1, 'data.available_slots')
            ->assertJsonPath('data.available_slots.0.id', $slot->id)
            ->assertJsonPath('data.available_slots.0.place_details', 'UP Diliman Academic Oval')
            ->assertJsonPath('data.active_meet_and_greet', null)
            ->assertJsonPath('data.contacts', null);

        $this->actingAs($this->petUser)->postJson($this->url(), ['slot_id' => $slot->id])
            ->assertCreated()
            // Booked, and waiting for the human: the request stays Approved (MG-04).
            ->assertJsonPath('data.status', 'approved')
            ->assertJsonPath('data.active_meet_and_greet.status', 'booked')
            ->assertJsonPath('data.active_meet_and_greet.slot.id', $slot->id)
            ->assertJsonPath('data.available_slots', [])
            // Nothing private until the human confirms (SEC-PRIV-02).
            ->assertJsonPath('data.contact_unlocked', false)
            ->assertJsonPath('data.contacts', null);

        $told = $this->human->notifications()->sole();
        $this->assertSame('meet_greet_booked', $told->type);
        $this->assertStringContainsString('10:00 AM', $told->body);
        $this->assertSame("/requests/{$this->request->id}", $told->action_url);
        $this->assertSame(1, ActivityLog::query()->where('action', 'meet_and_greet_booked')->where('actor_user_id', $this->petUser->id)->count());
    }

    public function test_a_slot_is_booked_only_while_it_is_open_and_the_request_is_approved(): void
    {
        $slot = $this->slot();

        $this->actingAs($this->petUser)->postJson($this->url(), [])->assertUnprocessable()->assertJsonValidationErrors(['slot_id']);

        // A slot that passed, was removed, or belongs to another home is not there to book.
        $elsewhere = HomeProfile::factory()->for(User::factory()->human()->active())->openToAdopt()->create();
        foreach ([$this->slot(['starts_at' => now()->subHour()]), $this->slot(['deleted_at' => now()]), $this->slot([], $elsewhere)] as $gone) {
            $this->actingAs($this->petUser)->postJson($this->url(), ['slot_id' => $gone->id])
                ->assertConflict()->assertJsonPath('code', 'slot_unavailable');
        }

        // Another pet got there first.
        $taken = $this->slot(['starts_at' => now()->addDays(5)]);
        $this->booking($taken, for: $this->otherRequest());
        $this->actingAs($this->petUser)->postJson($this->url(), ['slot_id' => $taken->id])
            ->assertConflict()->assertJsonPath('code', 'slot_already_booked');

        // Only an Approved request books.
        foreach (['sent', 'on_hold', 'meet_scheduled', 'awaiting_decision', 'declined'] as $status) {
            $this->request->forceFill(['status' => $status])->save();
            $this->actingAs($this->petUser)->postJson($this->url(), ['slot_id' => $slot->id])
                ->assertConflict()->assertJsonPath('code', 'invalid_request_state');
        }

        $this->assertSame(1, MeetAndGreet::query()->count());
    }

    public function test_only_the_two_sides_of_a_request_act_on_its_meet_and_greet(): void
    {
        $slot = $this->slot();
        $other = $this->slot(['starts_at' => now()->addDays(6)]);
        $otherPet = User::factory()->pet()->active()->create();
        Pet::factory()->for($otherPet)->lookingForAHome()->create();
        $otherHuman = User::factory()->human()->active()->create();
        HomeProfile::factory()->for($otherHuman)->openToAdopt()->create();
        $admin = User::factory()->admin()->active()->create();

        // Signed out gets nowhere.
        foreach (['', 'confirm', 'propose-time', 'reschedule', 'cancel'] as $action) {
            $this->postJson($this->url($action), ['slot_id' => $slot->id])->assertUnauthorized();
        }

        // Booking is the pet's own. Anyone else is answered like a request that doesn't exist (SEC-AUTHZ-04).
        foreach ([$otherPet, $this->human, $otherHuman, $admin] as $stranger) {
            $this->actingAs($stranger)->postJson($this->url(), ['slot_id' => $slot->id])->assertNotFound();
        }

        $this->booking($slot);

        // Confirming and proposing are the human's own.
        foreach ([$this->petUser, $otherPet, $otherHuman, $admin] as $stranger) {
            $this->actingAs($stranger)->postJson($this->url('confirm'))->assertNotFound();
            $this->actingAs($stranger)->postJson($this->url('propose-time'), ['proposed_slot_id' => $other->id])->assertNotFound();
        }

        // Rescheduling and cancelling are for the two sides only.
        foreach ([$otherPet, $otherHuman, $admin] as $stranger) {
            $this->actingAs($stranger)->postJson($this->url('reschedule'), ['slot_id' => $other->id])->assertNotFound();
            $this->actingAs($stranger)->postJson($this->url('cancel'), ['reason' => 'other'])->assertNotFound();
        }

        // A request that doesn't exist answers the same.
        $this->actingAs($this->petUser)->postJson('/api/v1/adoption-requests/999999/meet-and-greet', ['slot_id' => $slot->id])->assertNotFound();

        // An account that isn't Active never gets that far (SEC-AUTHZ-06).
        $pending = User::factory()->pet()->pendingVerification()->create();
        $this->actingAs($pending)->postJson($this->url(), ['slot_id' => $slot->id])->assertForbidden()->assertJsonPath('code', 'account_not_active');

        $this->assertSame('booked', $this->request->fresh()->activeMeetAndGreet->status);
    }

    public function test_booking_again_before_the_human_confirms_changes_the_slot(): void
    {
        $first = $this->slot();
        $second = $this->slot(['starts_at' => now()->addDays(6)]);
        $booking = $this->booking($first);

        // The slot already booked is not a change.
        $this->actingAs($this->petUser)->postJson($this->url(), ['slot_id' => $first->id])
            ->assertConflict()->assertJsonPath('code', 'slot_unchanged');

        $this->actingAs($this->petUser)->postJson($this->url(), ['slot_id' => $second->id])
            ->assertCreated()
            ->assertJsonPath('data.active_meet_and_greet.slot.id', $second->id)
            // The first slot is open again.
            ->assertJsonPath('data.available_slots.0.id', $first->id);

        $this->assertSame('ended', $booking->fresh()->status);
        $this->assertSame(1, MeetAndGreet::query()->active()->count());
    }

    public function test_confirming_schedules_the_meeting_and_opens_the_contact_details_to_both_sides(): void
    {
        $this->freezeSecond();
        $slot = $this->slot();
        $booking = $this->booking($slot);

        $this->actingAs($this->human)->postJson($this->url('confirm'))
            ->assertOk()
            ->assertJsonPath('data.status', 'meet_scheduled')
            ->assertJsonPath('data.meet_scheduled_at', now()->toISOString())
            // A scheduled meeting no longer runs out.
            ->assertJsonPath('data.expires_at', null)
            ->assertJsonPath('data.active_meet_and_greet.status', 'confirmed')
            ->assertJsonPath('data.contact_unlocked', true)
            ->assertJsonPath('data.contacts.caretaker_name', 'Liza Reyes')
            ->assertJsonPath('data.contacts.caretaker_contact_number', '09180000002');

        // The pet reads the human's number and exact address on the same request (MG-08).
        $this->actingAs($this->petUser)->getJson("/api/v1/adoption-requests/{$this->request->id}")
            ->assertOk()
            ->assertJsonPath('data.contacts.human_full_name', 'Ana Santos')
            ->assertJsonPath('data.contacts.human_contact_number', '09170000001')
            ->assertJsonPath('data.contacts.human_street_address', '12 Sample St., Brgy. Example');

        // The lists never carry them.
        $this->actingAs($this->petUser)->getJson('/api/v1/adoption-requests')->assertOk()->assertJsonMissingPath('data.0.contacts');

        $this->assertNotNull($booking->fresh()->confirmed_at);
        $this->assertSame('meet_greet_booked', $this->petUser->notifications()->sole()->type);
        $this->assertSame(1, ActivityLog::query()->where('action', 'adoption_request_meet_scheduled')->where('before_value', 'approved')->where('after_value', 'meet_scheduled')->count());
    }

    public function test_there_must_be_a_booking_still_ahead_to_confirm(): void
    {
        $this->actingAs($this->human)->postJson($this->url('confirm'))->assertConflict()->assertJsonPath('code', 'no_pending_booking');

        // Booked, but its time went by before the human answered.
        $slot = $this->slot();
        $this->booking($slot);
        $slot->forceFill(['starts_at' => now()->subMinute()])->save();
        $this->actingAs($this->human)->postJson($this->url('confirm'))->assertConflict()->assertJsonPath('code', 'slot_passed');
        $this->assertSame('approved', $this->request->fresh()->status);

        // Already confirmed: there is nothing left to confirm.
        $slot->forceFill(['starts_at' => now()->addDays(2)])->save();
        $this->actingAs($this->human)->postJson($this->url('confirm'))->assertOk();
        $this->actingAs($this->human)->postJson($this->url('confirm'))->assertConflict()->assertJsonPath('code', 'no_pending_booking');
    }

    public function test_proposing_another_time_reopens_booking_with_the_offered_slot(): void
    {
        $this->freezeSecond();
        $booked = $this->slot();
        $offered = $this->slot(['starts_at' => now()->addDays(6)]);
        $booking = $this->booking($booked, confirmed: true);

        $this->actingAs($this->human)->postJson($this->url('propose-time'), ['proposed_slot_id' => $offered->id, 'message' => '  Sunday morning works better for us.  '])
            ->assertOk()
            ->assertJsonPath('data.status', 'approved')
            ->assertJsonPath('data.meet_scheduled_at', null)
            // A fresh 14 days to book (§5.3).
            ->assertJsonPath('data.expires_at', now()->addDays(14)->toISOString())
            ->assertJsonPath('data.active_meet_and_greet', null)
            ->assertJsonPath('data.latest_meet_and_greet.id', $booking->id)
            ->assertJsonPath('data.latest_meet_and_greet.status', 'ended')
            ->assertJsonPath('data.latest_meet_and_greet.ended_by', 'human')
            ->assertJsonPath('data.latest_meet_and_greet.end_reason', 'moved_to_another_day')
            ->assertJsonPath('data.latest_meet_and_greet.end_details', 'Sunday morning works better for us.')
            ->assertJsonPath('data.latest_meet_and_greet.proposed_slot.id', $offered->id)
            // Both slots can be booked again, and the contact details are closed until a meeting is confirmed.
            ->assertJsonCount(2, 'data.available_slots')
            ->assertJsonPath('data.contact_unlocked', false)
            ->assertJsonPath('data.contacts', null);

        $this->assertSame('meet_greet_booked', $this->petUser->notifications()->sole()->type);
        // Meet Scheduled went back to Approved: logged like every change of status (SEC-LOG-01).
        $this->assertSame(1, ActivityLog::query()->where('action', 'adoption_request_booking_reopened')->where('before_value', 'meet_scheduled')->where('after_value', 'approved')->count());
    }

    public function test_only_a_slot_the_pet_can_book_is_proposed(): void
    {
        $booked = $this->slot();
        $this->booking($booked);

        $this->actingAs($this->human)->postJson($this->url('propose-time'), [])->assertUnprocessable()->assertJsonValidationErrors(['proposed_slot_id']);
        $this->actingAs($this->human)->postJson($this->url('propose-time'), ['proposed_slot_id' => $this->slot()->id, 'message' => str_repeat('a', 601)])
            ->assertUnprocessable()->assertJsonValidationErrors(['message']);

        // The slot the pet already booked is no other time.
        $this->actingAs($this->human)->postJson($this->url('propose-time'), ['proposed_slot_id' => $booked->id])
            ->assertConflict()->assertJsonPath('code', 'slot_unchanged');

        $this->actingAs($this->human)->postJson($this->url('propose-time'), ['proposed_slot_id' => $this->slot(['starts_at' => now()->subDay()])->id])
            ->assertConflict()->assertJsonPath('code', 'slot_unavailable');

        $taken = $this->slot(['starts_at' => now()->addDays(5)]);
        $this->booking($taken, for: $this->otherRequest());
        $this->actingAs($this->human)->postJson($this->url('propose-time'), ['proposed_slot_id' => $taken->id])
            ->assertConflict()->assertJsonPath('code', 'slot_already_booked');

        // Nothing changed: the booking still waits for an answer.
        $this->assertSame('booked', $this->request->fresh()->activeMeetAndGreet->status);

        // With no booking there is nothing to move.
        $this->request->activeMeetAndGreet->forceFill(['status' => 'ended'])->save();
        $this->actingAs($this->human)->postJson($this->url('propose-time'), ['proposed_slot_id' => $this->slot(['starts_at' => now()->addDays(8)])->id])
            ->assertConflict()->assertJsonPath('code', 'no_active_booking');
    }

    public function test_a_pet_reschedules_to_another_open_slot_and_the_human_confirms_again(): void
    {
        $first = $this->slot();
        $second = $this->slot(['starts_at' => now()->addDays(6)]);
        $booking = $this->booking($first, confirmed: true);

        $this->actingAs($this->petUser)->postJson($this->url('reschedule'), ['slot_id' => $second->id, 'reason' => ' My caretaker has a vet appointment that day. '])
            ->assertOk()
            // The human confirms the new time, so it is Approved again and the contact details close until then.
            ->assertJsonPath('data.status', 'approved')
            ->assertJsonPath('data.active_meet_and_greet.status', 'booked')
            ->assertJsonPath('data.active_meet_and_greet.slot.id', $second->id)
            ->assertJsonPath('data.contact_unlocked', false)
            ->assertJsonPath('data.contacts', null);

        $booking->refresh();
        $this->assertSame('ended', $booking->status);
        $this->assertSame('My caretaker has a vet appointment that day.', $booking->end_details);
        $this->assertSame($this->petUser->id, $booking->ended_by_user_id);
        $this->assertSame('meet_greet_booked', $this->human->notifications()->sole()->type);

        $this->actingAs($this->human)->postJson($this->url('confirm'))->assertOk()->assertJsonPath('data.status', 'meet_scheduled');
    }

    public function test_a_reschedule_never_double_books_a_slot(): void
    {
        $first = $this->slot();
        $this->booking($first);

        // Another pet holds the slot.
        $taken = $this->slot(['starts_at' => now()->addDays(5)]);
        $this->booking($taken, for: $this->otherRequest());
        $this->actingAs($this->petUser)->postJson($this->url('reschedule'), ['slot_id' => $taken->id])
            ->assertConflict()->assertJsonPath('code', 'slot_already_booked');

        $this->actingAs($this->petUser)->postJson($this->url('reschedule'), ['slot_id' => $first->id])
            ->assertConflict()->assertJsonPath('code', 'slot_unchanged');
        $this->actingAs($this->petUser)->postJson($this->url('reschedule'), ['slot_id' => $this->slot(['deleted_at' => now()])->id])
            ->assertConflict()->assertJsonPath('code', 'slot_unavailable');
        $this->actingAs($this->petUser)->postJson($this->url('reschedule'), ['slot_id' => $taken->id, 'reason' => str_repeat('a', 601)])
            ->assertUnprocessable()->assertJsonValidationErrors(['reason']);

        $this->assertSame(1, MeetAndGreet::query()->where('meet_greet_slot_id', $taken->id)->active()->count());
        $this->assertSame($first->id, $this->request->fresh()->activeMeetAndGreet->meet_greet_slot_id);

        // With no booking there is nothing to reschedule.
        $this->request->activeMeetAndGreet->forceFill(['status' => 'ended'])->save();
        $this->actingAs($this->petUser)->postJson($this->url('reschedule'), ['slot_id' => $this->slot(['starts_at' => now()->addDays(8)])->id])
            ->assertConflict()->assertJsonPath('code', 'no_active_booking');
    }

    public function test_either_side_cancels_with_a_reason_and_booking_reopens(): void
    {
        $this->freezeSecond();
        $slot = $this->slot();
        $booking = $this->booking($slot, confirmed: true);

        // The reason is always required, and is one of the four the dialog lists (MG-10).
        $this->actingAs($this->petUser)->postJson($this->url('cancel'), [])->assertUnprocessable()->assertJsonValidationErrors(['reason']);
        $this->actingAs($this->petUser)->postJson($this->url('cancel'), ['reason' => 'didnt_show_pet_side'])->assertUnprocessable()->assertJsonValidationErrors(['reason']);
        $this->actingAs($this->petUser)->postJson($this->url('cancel'), ['reason' => 'other', 'details' => str_repeat('a', 601)])
            ->assertUnprocessable()->assertJsonValidationErrors(['details']);

        $this->actingAs($this->petUser)->postJson($this->url('cancel'), ['reason' => 'pet_unwell', 'details' => '  Mochi has a fever.  '])
            ->assertOk()
            ->assertJsonPath('data.status', 'approved')
            ->assertJsonPath('data.meet_scheduled_at', null)
            ->assertJsonPath('data.expires_at', now()->addDays(14)->toISOString())
            ->assertJsonPath('data.active_meet_and_greet', null)
            ->assertJsonPath('data.latest_meet_and_greet.ended_by', 'pet')
            ->assertJsonPath('data.latest_meet_and_greet.end_reason', 'pet_unwell')
            ->assertJsonPath('data.latest_meet_and_greet.end_details', 'Mochi has a fever.')
            // The slot is open again, and the contact details are closed.
            ->assertJsonPath('data.available_slots.0.id', $slot->id)
            ->assertJsonPath('data.contact_unlocked', false)
            ->assertJsonPath('data.contacts', null);

        $this->assertSame('ended', $booking->fresh()->status);

        // The other side is told, with the reason.
        $told = $this->human->notifications()->sole();
        $this->assertSame('meet_greet_cancelled', $told->type);
        $this->assertSame('Mochi cancelled the Meet & Greet', $told->title);
        $this->assertStringContainsString('Pet is unwell', $told->body);

        // Nothing is left to cancel.
        $this->actingAs($this->human)->postJson($this->url('cancel'), ['reason' => 'other'])->assertConflict()->assertJsonPath('code', 'no_active_booking');

        // The human cancels a booking too, before or after confirming it.
        $this->booking($slot);
        $this->actingAs($this->human)->postJson($this->url('cancel'), ['reason' => 'schedule_conflict'])
            ->assertOk()->assertJsonPath('data.latest_meet_and_greet.ended_by', 'human');
        $this->assertSame('Ana Santos cancelled the Meet & Greet', $this->petUser->notifications()->sole()->title);
    }
}
