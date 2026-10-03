<?php

namespace Database\Factories;

use App\Enums\PetEnergyLevel;
use App\Enums\PetExperienceNeeded;
use App\Enums\PetGoodWith;
use App\Enums\PetSex;
use App\Enums\PetSize;
use App\Enums\PetSpaceNeeds;
use App\Enums\PetStatus;
use App\Enums\PetTimeAlone;
use App\Enums\PetSpecialNeed;
use App\Models\Pet;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Pet>
 */
class PetFactory extends Factory
{
    protected $model = Pet::class;

    public function definition(): array
    {
        return [
            'user_id' => UserFactory::new()->sequence(fn (array $attrs) => $attrs['user_id'] ?? null),
            'name' => fake()->words(2, true),
            'species' => fake()->randomElement(['dog', 'cat', 'other']),
            'breed' => fake()->optional()->word(),
            'approximate_age_months' => fake()->numberBetween(1, 120),
            'sex' => fake()->randomElement([PetSex::Female->value, PetSex::Male->value]),
            'size' => fake()->randomElement([PetSize::Small->value, PetSize::Medium->value, PetSize::Large->value]),
            'currently_at' => fake()->optional()->word(),
            'city' => fake()->cityName(),
            'province' => fake()->word(),
            'caretaker_name' => fake()->name(),
            'caretaker_contact_number' => '09' . fake()->numerify('### ### ###'),
            'bio' => fake()->optional()->paragraph(),
            'energy_level' => fake()->randomElement([PetEnergyLevel::Low->value, PetEnergyLevel::Medium->value, PetEnergyLevel::High->value]),
            'good_with_kids' => fake()->randomElement([PetGoodWith::Yes->value, PetGoodWith::No->value, PetGoodWith::Unknown->value]),
            'good_with_dogs' => fake()->randomElement([PetGoodWith::Yes->value, PetGoodWith::No->value, PetGoodWith::Unknown->value]),
            'good_with_cats' => fake()->randomElement([PetGoodWith::Yes->value, PetGoodWith::No->value, PetGoodWith::Unknown->value]),
            'time_alone' => fake()->randomElement([PetTimeAlone::UpTo2Hrs->value, PetTimeAlone::UpTo4Hrs->value, PetTimeAlone::UpTo6Hrs->value, PetTimeAlone::EightPlusHrs->value]),
            'space_needs' => fake()->randomElement([PetSpaceNeeds::ApartmentOk->value, PetSpaceNeeds::NeedsYardOrDailyWalks->value, PetSpaceNeeds::GroundFloor->value]),
            'experience_needed' => fake()->randomElement([PetExperienceNeeded::FirstTimeOk->value, PetExperienceNeeded::SomeExperience->value, PetExperienceNeeded::ExperiencedOnly->value]),
            'health_notes' => fake()->optional()->sentence(),
            'cover_photo_path' => fake()->optional()->word(),
            'status' => PetStatus::Draft->value,
            'published_at' => null,
        ];
    }

    public function lookingForAHome(): static
    {
        return $this->state(fn (array $attrs) => [
            'status' => PetStatus::LookingForAHome->value,
            'published_at' => now(),
        ]);
    }

    public function adopted(): static
    {
        return $this->state(fn (array $attrs) => [
            'status' => PetStatus::AdoptedHired->value,
            'published_at' => null,
        ]);
    }
}
