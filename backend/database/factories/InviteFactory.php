<?php

namespace Database\Factories;

use App\Models\Invite;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Invite>
 */
class InviteFactory extends Factory
{
    protected $model = Invite::class;

    public function definition(): array
    {
        return [
            'home_profile_id' => HomeProfileFactory::new()->sequence(fn (array $attrs) => $attrs['home_profile_id'] ?? null),
            'pet_id' => PetFactory::new()->sequence(fn (array $attrs) => $attrs['pet_id'] ?? null),
            'note' => fake()->optional()->sentence(),
            'dismissed_at' => null,
        ];
    }
}
