<?php

namespace Database\Factories;

use App\Models\Bookmark;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Bookmark>
 */
class BookmarkFactory extends Factory
{
    protected $model = Bookmark::class;

    public function definition(): array
    {
        return [
            'user_id' => UserFactory::new(),
            'pet_id' => PetFactory::new(),
            'home_profile_id' => HomeProfileFactory::new(),
        ];
    }

    public function onPet(): static
    {
        return $this->state(fn (array $attrs) => [
            'pet_id' => PetFactory::new(),
            'home_profile_id' => null,
        ]);
    }

    public function onHome(): static
    {
        return $this->state(fn (array $attrs) => [
            'pet_id' => null,
            'home_profile_id' => HomeProfileFactory::new(),
        ]);
    }
}
