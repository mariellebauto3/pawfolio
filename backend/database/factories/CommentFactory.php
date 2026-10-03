<?php

namespace Database\Factories;

use App\Models\Comment;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Comment>
 */
class CommentFactory extends Factory
{
    protected $model = Comment::class;

    public function definition(): array
    {
        return [
            'post_id' => PostFactory::new()->sequence(fn (array $attrs) => $attrs['post_id'] ?? null),
            'user_id' => UserFactory::new()->sequence(fn (array $attrs) => $attrs['user_id'] ?? null),
            'parent_comment_id' => null,
            'body' => fake()->sentence(),
            'removed_at' => null,
        ];
    }

    public function reply(): static
    {
        return $this->state(fn (array $attrs) => [
            'parent_comment_id' => CommentFactory::new()->sequence(fn (array $attrs) => $attrs['parent_comment_id'] ?? null),
        ]);
    }

    public function removed(): static
    {
        return $this->state(fn (array $attrs) => ['removed_at' => now()]);
    }
}
