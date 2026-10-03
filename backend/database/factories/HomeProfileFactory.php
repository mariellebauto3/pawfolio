<?php

namespace Database\Factories;

use App\Enums\ActivityLevel;
use App\Enums\AnnouncementAudience;
use App\Enums\AcceptedSpecies;
use App\Enums\HoursAway;
use App\Enums\HomeType;
use App\Enums\OtherPetType;
use App\Enums\PetExperience;
use App\Enums\PetSex;
use App\Enums\PetSize;
use App\Enums\SpecialNeedsWillingness;
use App\Models\HomeProfile;
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
            'user_id' => UserFactory::new()->sequence(fn (array $attrs) => $attrs['user_id'] ?? null),
            'full_name' => fake()->name(),
            'birthdate' => fake()->optional()->date(),
            'contact_number' => '09' . fake()->numerify('### ### ###'),
            'city' => fake()->cityName(),
            'province' => fake()->word(),
            'street_address' => fake()->optional()->word(),
            'headline' => fake()->optional()->sentence(),
            'about_home' => fake()->optional()->paragraph(),
            'profile_photo_path' => fake()->optional()->word(),
            'cover_photo_path' => fake()->optional()->word(),
            'home_type' => fake()->randomElement([HomeType::House->value, HomeType::Condo->value, HomeType::Apartment->value, HomeType::Townhouse->value]),
            'outdoor_space' => fake()->randomElement([ActivityLevel::Relaxed->value, OutdoorSpace::None->value, OutdoorSpace::Balcony->value, ActivityLevel::Active->value]),
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
        return $this->state(fn (array $attrs) => [
            'is_open_to_adopt' => true,
            'quiz_completed_at' => now(),
        ]);
    }

    public function withQuizCompleted(): static
    {
        return $this->state(fn (array $attrs) => [
            'quiz_completed_at' => now(),
            'furparent_at' => null,
        ]);
    }
}
