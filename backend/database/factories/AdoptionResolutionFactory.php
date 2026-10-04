<?php

namespace Database\Factories;

use App\Enums\AdoptionAction;
use App\Models\AdoptionResolution;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<AdoptionResolution>
 */
class AdoptionResolutionFactory extends Factory
{
    protected $model = AdoptionResolution::class;

    public function definition(): array
    {
        return [
            'admin_user_id' => UserFactory::new(),
            'pet_id' => PetFactory::new(),
            'adoption_request_id' => AdoptionRequestFactory::new(),
            'action' => AdoptionAction::CloseRequest->value,
            'reason' => fake()->sentence(),
        ];
    }

    public function cancelAdoption(): static
    {
        return $this->state(fn (array $attrs) => [
            'action' => AdoptionAction::CancelAdoption->value,
            'reason' => fake()->sentence(),
        ]);
    }

    public function returnToLookingForAHome(): static
    {
        return $this->state(fn (array $attrs) => [
            'action' => AdoptionAction::ReturnToLookingForAHome->value,
            'reason' => fake()->sentence(),
        ]);
    }

    public function closeRequest(): static
    {
        return $this->state(fn (array $attrs) => [
            'action' => AdoptionAction::CloseRequest->value,
            'reason' => fake()->sentence(),
        ]);
    }

    public function reopenMeetGreetBooking(): static
    {
        return $this->state(fn (array $attrs) => [
            'action' => AdoptionAction::ReopenMeetGreetBooking->value,
            'reason' => fake()->sentence(),
        ]);
    }
}
