<?php

namespace Database\Factories;

use App\Models\MatchScore;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<MatchScore>
 */
class MatchScoreFactory extends Factory
{
    protected $model = MatchScore::class;

    public function definition(): array
    {
        return [
            'pet_id' => PetFactory::new()->sequence(fn (array $attrs) => $attrs['pet_id'] ?? null),
            'home_profile_id' => HomeProfileFactory::new()->sequence(fn (array $attrs) => $attrs['home_profile_id'] ?? null),
            'score' => fake()->numberBetween(0, 100),
            'activity_points' => null,
            'hours_away_points' => null,
            'space_points' => null,
            'experience_points' => null,
            'size_age_points' => null,
            'compatibility_points' => null,
            'special_needs_points' => null,
            'calculated_at' => now(),
        ];
    }
}
