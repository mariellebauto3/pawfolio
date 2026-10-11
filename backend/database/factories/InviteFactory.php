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
            'home_profile_id' => HomeProfileFactory::new(),
            'pet_id' => PetFactory::new(),
            'note' => fake()->optional()->sentence(),
            'dismissed_at' => null,
        ];
    }
}
