<?php

namespace Database\Factories;

use App\Enums\AdoptionRequestStatus;
use App\Models\AdoptionRequest;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<AdoptionRequest>
 */
class AdoptionRequestFactory extends Factory
{
    protected $model = AdoptionRequest::class;

    public function definition(): array
    {
        return [
            'pet_id' => PetFactory::new(),
            'home_profile_id' => HomeProfileFactory::new(),
            'status' => AdoptionRequestStatus::Sent->value,
            'cover_letter' => fake()->paragraph(),
            'caretaker_notes' => null,
            'approval_message' => null,
            'decline_reason' => null,
            'decision_message' => null,
            'withdraw_reason' => null,
            'sent_at' => now(),
            'expires_at' => now()->addDays(14),
            'approved_at' => null,
            'meet_scheduled_at' => null,
            'awaiting_decision_at' => null,
            'overdue_flagged_at' => null,
            'closed_at' => null,
        ];
    }

    public function onHold(): static
    {
        return $this->state(fn (array $attrs) => ['status' => AdoptionRequestStatus::OnHold->value]);
    }

    public function approved(): static
    {
        return $this->state(fn (array $attrs) => [
            'status' => AdoptionRequestStatus::Approved->value,
            'approved_at' => now(),
            'expires_at' => now()->addDays(14),
        ]);
    }

    public function meetScheduled(): static
    {
        return $this->state(fn (array $attrs) => [
            'status' => AdoptionRequestStatus::MeetScheduled->value,
            'meet_scheduled_at' => now(),
            'expires_at' => now()->addDays(14),
        ]);
    }

    public function awaitingDecision(): static
    {
        return $this->state(fn (array $attrs) => [
            'status' => AdoptionRequestStatus::AwaitingDecision->value,
            'meet_scheduled_at' => now()->subDay(),
            'awaiting_decision_at' => now(),
            'expires_at' => now()->addDays(14),
        ]);
    }

    public function declined(): static
    {
        return $this->state(fn (array $attrs) => [
            'status' => AdoptionRequestStatus::Declined->value,
            'decline_reason' => fake()->randomElement(['not_right_fit', 'not_adopting_now', 'another_pet_joining', 'other']),
            'decision_message' => fake()->sentence(),
            'closed_at' => now(),
        ]);
    }

    public function adopted(): static
    {
        return $this->state(fn (array $attrs) => [
            'status' => AdoptionRequestStatus::Adopted->value,
            'approved_at' => now(),
            'meet_scheduled_at' => now(),
            'decision_message' => null,
            'expires_at' => now()->subDay(),
            'closed_at' => now(),
        ]);
    }

    public function withdrawn(): static
    {
        return $this->state(fn (array $attrs) => [
            'status' => AdoptionRequestStatus::Withdrawn->value,
            'withdraw_reason' => fake()->randomElement(['found_better_match', 'caretaker_cant_make_schedule', 'pet_no_longer_available', 'other']),
            'closed_at' => now(),
        ]);
    }

    public function expired(): static
    {
        return $this->state(fn (array $attrs) => [
            'status' => AdoptionRequestStatus::Expired->value,
            'expires_at' => now()->subDays(1),
            'closed_at' => now(),
        ]);
    }

    public function closed(): static
    {
        return $this->state(fn (array $attrs) => [
            'status' => AdoptionRequestStatus::Closed->value,
            'closed_at' => now(),
        ]);
    }
}
