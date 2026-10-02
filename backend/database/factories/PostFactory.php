<?php

namespace Database\Factories;

use App\Enums\PostType;
use App\Models\Post;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Post>
 */
class PostFactory extends Factory
{
    protected $model = Post::class;

    public function definition(): array
    {
        return [
            'author_user_id' => UserFactory::new()->sequence(fn (array $attrs) => $attrs['author_user_id'] ?? null),
            'type' => PostType::Post->value,
            'title' => fake()->optional()->sentence(),
            'body' => fake()->paragraph(),
            'adopted_pet_id' => null,
            'removed_at' => null,
            'deleted_at' => null,
        ];
    }

    public function forHire(): static
    {
        return $this->state(fn (array $attrs) => ['type' => PostType::ForHire->value]);
    }

    public function hired(): static
    {
        return $this->state(fn (array $attrs) => ['type' => PostType::Hired->value]);
    }

    public function update(): static
    {
        return $this->state(fn (array $attrs) => ['type' => PostType::Update->value]);
    }

    public function adoptionStory(): static
    {
        return $this->state(fn (array $attrs) => [
            'type' => PostType::AdoptionStory->value,
            'title' => fake()->sentence(),
            'adopted_pet_id' => PetFactory::new()->sequence(fn (array $attrs) => $attrs['adopted_pet_id'] ?? null),
        ]);
    }

    public function removed(): static
    {
        return $this->state(fn (array $attrs) => ['removed_at' => now()]);
    }

    public function deleted(): static
    {
        return $this->state(fn (array $attrs) => ['deleted_at' => now()]);
    }
}
