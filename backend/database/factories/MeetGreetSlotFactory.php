<?php

namespace Database\Factories;

use App\Enums\MeetGreetPlaceType;
use App\Models\MeetGreetSlot;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<MeetGreetSlot>
 */
class MeetGreetSlotFactory extends Factory
{
    protected $model = MeetGreetSlot::class;

    public function definition(): array
    {
        return [
            'home_profile_id' => HomeProfileFactory::new()->sequence(fn (array $attrs) => $attrs['home_profile_id'] ?? null),
            'starts_at' => now()->addDays(fake()->numberBetween(1, 30))->addHours(fake()->numberBetween(9, 17))->addMinutes(fake()->numberBetween(0, 59)),
            'place_type' => MeetGreetPlaceType::PublicSpot->value,
            'place_details' => fake()->optional()->word(),
            'deleted_at' => null,
        ];
    }
}
