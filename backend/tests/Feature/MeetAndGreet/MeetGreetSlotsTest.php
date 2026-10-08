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
 * A human's Meet & Greet availability (MG-01, MG-02, FR11, docs/api/adoption-and-meet-greet.md): the slots still
 * ahead with who booked them, the Meet & Greets already behind, adding slots and removing open ones. A human reads
 * and changes only their own.
 */
class MeetGreetSlotsTest extends TestCase
{
    use RefreshDatabase;

    private const URL = '/api/v1/meet-greet-slots';

    private User $human;

    private HomeProfile $home;

    protected function setUp(): void
    {
        parent::setUp();

        $this->human = User::factory()->human()->active()->create();
        $this->home = HomeProfile::factory()->for($this->human)->openToAdopt()->create(['full_name' => 'Ana Santos']);
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

    /** A pet's request with this home, with a booking of the slot. */
    private function bookedBy(string $petName, MeetGreetSlot $slot, string $requestState = 'approved', array $booking = []): MeetAndGreet
    {
        $pet = Pet::factory()->for(User::factory()->pet()->active())->lookingForAHome()->create(['name' => $petName]);
        $request = AdoptionRequest::factory()->{$requestState}()->create(['pet_id' => $pet->id, 'home_profile_id' => $this->home->id]);

        return MeetAndGreet::factory()->create(['adoption_request_id' => $request->id, 'meet_greet_slot_id' => $slot->id, ...$booking]);
    }

    private function body(array $with = []): array
    {
        return ['starts_at' => now()->addDays(2)->toISOString(), 'place_type' => 'public_spot', 'place_details' => 'UP Diliman Academic Oval', ...$with];
    }

    public function test_a_human_adds_a_slot(): void
    {
        $this->freezeSecond();

        $this->actingAs($this->human)->postJson(self::URL, $this->body(['place_details' => '  UP Diliman Academic Oval, near the sunken garden  ']))
            ->assertCreated()
            // Always a list, one slot or several.
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.home_profile_id', $this->home->id)
            ->assertJsonPath('data.0.starts_at', now()->addDays(2)->toISOString())
            ->assertJsonPath('data.0.place_type', 'public_spot')
            // Trimmed before it is stored (SEC-INPUT-06).
            ->assertJsonPath('data.0.place_details', 'UP Diliman Academic Oval, near the sunken garden');

        $this->assertSame(1, ActivityLog::query()->where('action', 'meet_greet_slots_added')->where('actor_user_id', $this->human->id)->count());
    }

    public function test_a_slot_repeats_weekly_for_up_to_four_weeks(): void
    {
        $this->freezeSecond();

        $this->actingAs($this->human)->postJson(self::URL, $this->body(['repeat_weeks' => 4]))
            ->assertCreated()
            ->assertJsonCount(4, 'data')
            ->assertJsonPath('data.0.starts_at', now()->addDays(2)->toISOString())
            ->assertJsonPath('data.3.starts_at', now()->addDays(2)->addWeeks(3)->toISOString());

        $this->actingAs($this->human)->postJson(self::URL, $this->body(['starts_at' => now()->addDays(40)->toISOString(), 'repeat_weeks' => 5]))
            ->assertUnprocessable()->assertJsonValidationErrors(['repeat_weeks']);

        $this->assertSame(4, MeetGreetSlot::query()->count());
    }

    public function test_a_slot_needs_a_time_ahead_and_a_place(): void
    {
        $this->actingAs($this->human)->postJson(self::URL, [])
            ->assertUnprocessable()->assertJsonValidationErrors(['starts_at', 'place_type', 'place_details']);

        $this->actingAs($this->human)->postJson(self::URL, $this->body(['starts_at' => now()->subHour()->toISOString()]))
            ->assertUnprocessable()->assertJsonPath('errors.starts_at.0', 'Choose a time that is still ahead.');
        $this->actingAs($this->human)->postJson(self::URL, $this->body(['starts_at' => now()->addYears(2)->toISOString()]))
            ->assertUnprocessable()->assertJsonValidationErrors(['starts_at']);
        $this->actingAs($this->human)->postJson(self::URL, $this->body(['place_type' => 'my_house']))
            ->assertUnprocessable()->assertJsonValidationErrors(['place_type']);
        $this->actingAs($this->human)->postJson(self::URL, $this->body(['place_details' => '   ']))
            ->assertUnprocessable()->assertJsonValidationErrors(['place_details']);
        $this->actingAs($this->human)->postJson(self::URL, $this->body(['place_details' => str_repeat('a', 256)]))
            ->assertUnprocessable()->assertJsonValidationErrors(['place_details']);

        $this->assertSame(0, MeetGreetSlot::query()->count());

        // A meeting at the caretaker's is the pet's side to place, so it needs no details from the human.
        $this->actingAs($this->human)->postJson(self::URL, $this->body(['place_type' => 'caretaker_location', 'place_details' => '']))
            ->assertCreated()->assertJsonPath('data.0.place_details', null);
    }

    public function test_two_slots_cannot_start_at_the_same_time(): void
    {
        $this->freezeSecond();
        $this->slot(['starts_at' => now()->addDays(9)]);

        // The second week of the four is taken already, so none of them is added.
        $this->actingAs($this->human)->postJson(self::URL, $this->body(['repeat_weeks' => 4]))
            ->assertUnprocessable()->assertJsonValidationErrors(['starts_at']);
        $this->actingAs($this->human)->postJson(self::URL, $this->body(['starts_at' => now()->addDays(9)->toISOString()]))
            ->assertUnprocessable()->assertJsonPath('errors.starts_at.0', 'You already have a slot at that time.');
        $this->assertSame(1, MeetGreetSlot::query()->count());

        // A removed slot doesn't hold its time, and another human's slot is no concern of this one.
        $this->slot(['starts_at' => now()->addDays(16), 'deleted_at' => now()]);
        $this->slot(['starts_at' => now()->addDays(23)], HomeProfile::factory()->for(User::factory()->human()->active())->create());
        $this->actingAs($this->human)->postJson(self::URL, $this->body(['starts_at' => now()->addDays(16)->toISOString(), 'repeat_weeks' => 2]))
            ->assertCreated()->assertJsonCount(2, 'data');
    }

    public function test_only_an_active_human_keeps_slots(): void
    {
        $this->postJson(self::URL, $this->body())->assertUnauthorized();
        $this->getJson(self::URL)->assertUnauthorized();

        $pet = User::factory()->pet()->active()->create();
        Pet::factory()->for($pet)->lookingForAHome()->create();
        $this->actingAs($pet)->postJson(self::URL, $this->body())->assertForbidden();
        $this->actingAs($pet)->getJson(self::URL)->assertForbidden();
        $this->actingAs(User::factory()->admin()->active()->create())->postJson(self::URL, $this->body())->assertForbidden();

        // Pending, Denied and Suspended accounts reach nothing (SEC-AUTHZ-06).
        foreach (['pendingVerification', 'denied', 'suspended'] as $state) {
            $blocked = User::factory()->human()->{$state}()->create();
            HomeProfile::factory()->for($blocked)->create();
            $this->actingAs($blocked)->postJson(self::URL, $this->body())->assertForbidden()->assertJsonPath('code', 'account_not_active');
            $this->actingAs($blocked)->getJson(self::URL)->assertForbidden()->assertJsonPath('code', 'account_not_active');
        }

        $this->assertSame(0, MeetGreetSlot::query()->count());
    }

    public function test_a_human_reads_their_upcoming_slots_with_who_booked_them(): void
    {
        $open = $this->slot(['starts_at' => now()->addDays(5), 'place_type' => 'shelter', 'place_details' => 'Happy Paws Rescue']);
        $booked = $this->slot(['starts_at' => now()->addDays(2)]);
        $booking = $this->bookedBy('Mochi', $booked);
        // A booking that ended leaves its slot open.
        $freed = $this->slot(['starts_at' => now()->addDays(7)]);
        $this->bookedBy('Pepper', $freed, 'approved', ['status' => 'ended', 'ended_at' => now()]);

        // Not listed: a slot that passed, one that was removed, and another human's.
        $this->slot(['starts_at' => now()->subDay()]);
        $this->slot(['starts_at' => now()->addDays(4), 'deleted_at' => now()]);
        $this->slot([], HomeProfile::factory()->for(User::factory()->human()->active())->create());

        $this->actingAs($this->human)->getJson(self::URL)
            ->assertOk()
            ->assertJsonPath('meta.total', 3)
            // Soonest first.
            ->assertJsonPath('data.0.id', $booked->id)
            ->assertJsonPath('data.0.is_booked', true)
            ->assertJsonPath('data.0.active_booking.id', $booking->id)
            ->assertJsonPath('data.0.active_booking.status', 'booked')
            ->assertJsonPath('data.0.active_booking.adoption_request_id', $booking->adoption_request_id)
            ->assertJsonPath('data.0.active_booking.pet_name', 'Mochi')
            ->assertJsonPath('data.1.id', $open->id)
            ->assertJsonPath('data.1.place_type', 'shelter')
            ->assertJsonPath('data.1.place_details', 'Happy Paws Rescue')
            ->assertJsonPath('data.1.is_booked', false)
            ->assertJsonPath('data.1.active_booking', null)
            ->assertJsonPath('data.2.id', $freed->id)
            ->assertJsonPath('data.2.is_booked', false);

        $this->actingAs($this->human)->getJson(self::URL.'?per_page=2&page=2')
            ->assertOk()->assertJsonPath('meta.last_page', 2)->assertJsonCount(1, 'data');
        $this->actingAs($this->human)->getJson(self::URL.'?when=someday')->assertUnprocessable()->assertJsonValidationErrors(['when']);
    }

    public function test_past_meet_and_greets_are_the_confirmed_ones_whose_time_has_come(): void
    {
        $met = $this->slot(['starts_at' => now()->subDays(3)]);
        $awaiting = $this->bookedBy('Bantay', $met, 'awaitingDecision', ['status' => 'ended', 'confirmed_at' => now()->subDays(6), 'ended_at' => now()->subDays(3)]);
        $earlier = $this->slot(['starts_at' => now()->subDays(40)]);
        $adopted = $this->bookedBy('Luna', $earlier, 'adopted', ['status' => 'ended', 'confirmed_at' => now()->subDays(45), 'ended_at' => now()->subDays(40)]);

        // Not a past meeting: one called off before its time, one never confirmed, and one still ahead.
        $this->bookedBy('Called off', $this->slot(['starts_at' => now()->subDays(2)]), 'approved', ['status' => 'ended', 'confirmed_at' => now()->subDays(6), 'ended_at' => now()->subDays(5), 'end_reason' => 'schedule_conflict']);
        $this->bookedBy('Unanswered', $this->slot(['starts_at' => now()->subDays(1)]), 'approved', ['status' => 'ended', 'ended_at' => now()->subDays(4)]);
        $this->bookedBy('Ahead', $this->slot(['starts_at' => now()->addDays(2)]), 'meetScheduled', ['status' => 'confirmed', 'confirmed_at' => now()]);

        $this->actingAs($this->human)->getJson(self::URL.'?when=past')
            ->assertOk()
            ->assertJsonPath('meta.total', 2)
            // Latest first.
            ->assertJsonPath('data.0.id', $awaiting->id)
            ->assertJsonPath('data.0.pet_name', 'Bantay')
            ->assertJsonPath('data.0.request_status', 'awaiting_decision')
            ->assertJsonPath('data.0.adoption_request_id', $awaiting->adoption_request_id)
            ->assertJsonPath('data.0.end_reason', null)
            ->assertJsonPath('data.0.slot.id', $met->id)
            ->assertJsonPath('data.1.id', $adopted->id)
            ->assertJsonPath('data.1.request_status', 'adopted');

        // Another human reads none of them.
        $other = User::factory()->human()->active()->create();
        HomeProfile::factory()->for($other)->create();
        $this->actingAs($other)->getJson(self::URL.'?when=past')->assertOk()->assertJsonPath('meta.total', 0);
        $this->actingAs($other)->getJson(self::URL)->assertOk()->assertJsonPath('meta.total', 0);
    }

    public function test_a_human_removes_an_open_slot_of_their_own(): void
    {
        $open = $this->slot();
        $this->actingAs($this->human)->deleteJson(self::URL."/{$open->id}")->assertOk();
        $this->assertNotNull($open->fresh()->deleted_at);

        // Removed already, never there, or another human's: all the same answer (SEC-AUTHZ-04).
        $this->actingAs($this->human)->deleteJson(self::URL."/{$open->id}")->assertNotFound();
        $this->actingAs($this->human)->deleteJson(self::URL.'/999999')->assertNotFound();
        $theirs = $this->slot([], HomeProfile::factory()->for(User::factory()->human()->active())->create());
        $this->actingAs($this->human)->deleteJson(self::URL."/{$theirs->id}")->assertNotFound();
        $this->assertNull($theirs->fresh()->deleted_at);

        // A slot a pet has booked stays until the booking is moved or cancelled.
        $booked = $this->slot(['starts_at' => now()->addDays(4)]);
        $this->bookedBy('Mochi', $booked);
        $this->actingAs($this->human)->deleteJson(self::URL."/{$booked->id}")->assertConflict()->assertJsonPath('code', 'slot_has_active_booking');
        $this->assertNull($booked->fresh()->deleted_at);
    }
}
