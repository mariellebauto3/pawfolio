<?php

namespace Database\Factories;

use App\Models\Adoption;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Adoption>
 */
class AdoptionFactory extends Factory
{
    protected $model = Adoption::class;

    public function definition(): array
    {
        return [
            'pet_id' => PetFactory::new()->sequence(fn (array $attrs) => $attrs['pet_id'] ?? null),
            'home_profile_id' => HomeProfileFactory::new()->sequence(fn (array $attrs) => $attrs['home_profile_id'] ?? null),
            'adoption_request_id' => AdoptionRequestFactory::new()->sequence(fn (array $attrs) => $attrs['adoption_request_id'] ?? null),
            'adopted_at' => now(),
            'link_removed_at' => null,
        ];
    }

    public function removed(): static
    {
        return $this->state(fn (array $attrs) => ['link_removed_at' => now()]);
    }
}
