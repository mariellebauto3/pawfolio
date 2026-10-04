<?php

namespace Database\Factories;

use App\Enums\MeetAndGreetEndReason;
use App\Enums\MeetAndGreetStatus;
use App\Models\MeetAndGreet;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<MeetAndGreet>
 */
class MeetAndGreetFactory extends Factory
{
    protected $model = MeetAndGreet::class;

    public function definition(): array
    {
        return [
            'adoption_request_id' => AdoptionRequestFactory::new(),
            'meet_greet_slot_id' => MeetGreetSlotFactory::new(),
            'status' => MeetAndGreetStatus::Booked->value,
            'booked_at' => now(),
            'confirmed_at' => null,
            'ended_at' => null,
            'ended_by_user_id' => null,
            'end_reason' => null,
            'end_details' => null,
            'proposed_slot_id' => null,
        ];
    }

    public function confirmed(): static
    {
        return $this->state(fn (array $attrs) => [
            'status' => MeetAndGreetStatus::Confirmed->value,
            'confirmed_at' => now(),
        ]);
    }

    public function ended(): static
    {
        return $this->state(fn (array $attrs) => [
            'status' => MeetAndGreetStatus::Ended->value,
            'ended_at' => now(),
            'ended_by_user_id' => UserFactory::new(),
            'end_reason' => fake()->randomElement([MeetAndGreetEndReason::ScheduleConflict->value, MeetAndGreetEndReason::Other->value, MeetAndGreetEndReason::PetUnwell->value]),
            'end_details' => fake()->sentence(),
        ]);
    }
}
