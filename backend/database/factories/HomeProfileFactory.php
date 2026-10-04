<?php

namespace Database\Factories;

use App\Enums\ActivityLevel;
use App\Enums\HomeType;
use App\Enums\HoursAway;
use App\Enums\OutdoorSpace;
use App\Enums\PetExperience;
use App\Enums\SpecialNeedsWillingness;
use App\Models\HomeProfile;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<HomeProfile>
 */
class HomeProfileFactory extends Factory
{
    protected $model = HomeProfile::class;

    public function definition(): array
    {
        return [
            'user_id' => User::factory()->humanAccount(),
            'full_name' => fake()->name(),
            'birthdate' => '1992-05-14',
            'contact_number' => '09'.fake()->numerify('#########'),
            'city' => 'Quezon City',
            'province' => 'Metro Manila',
            'street_address' => fake()->streetAddress(),
            'headline' => fake()->optional()->sentence(),
            'about_home' => fake()->optional()->paragraph(),
            'profile_photo_path' => null,
            'cover_photo_path' => null,
            'home_type' => fake()->randomElement([HomeType::House->value, HomeType::Condo->value, HomeType::Apartment->value, HomeType::Townhouse->value]),
            'outdoor_space' => fake()->randomElement([OutdoorSpace::None->value, OutdoorSpace::Balcony->value, OutdoorSpace::SmallYard->value, OutdoorSpace::LargeYard->value]),
            'activity_level' => fake()->randomElement([ActivityLevel::Relaxed->value, ActivityLevel::Moderate->value, ActivityLevel::Active->value, ActivityLevel::VeryActive->value]),
            'hours_away' => fake()->randomElement([HoursAway::ZeroToTwo->value, HoursAway::ThreeToFive->value, HoursAway::SixToEight->value, HoursAway::NinePlus->value]),
            'pet_experience' => fake()->randomElement([PetExperience::FirstTime->value, PetExperience::Some->value, PetExperience::Experienced->value]),
            'special_needs_willingness' => fake()->randomElement([SpecialNeedsWillingness::Yes->value, SpecialNeedsWillingness::MinorNeedsOnly->value, SpecialNeedsWillingness::No->value]),
            'is_open_to_adopt' => false,
            'quiz_completed_at' => null,
            'furparent_at' => null,
        ];
    }

    public function openToAdopt(): static
    {
        return $this->state(fn () => [
            'is_open_to_adopt' => true,
            'quiz_completed_at' => now(),
        ]);
    }

    public function withQuizCompleted(): static
    {
        return $this->state(fn () => [
            'quiz_completed_at' => now(),
        ]);
    }
}
