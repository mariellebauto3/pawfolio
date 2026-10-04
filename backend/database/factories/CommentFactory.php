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
            'post_id' => PostFactory::new(),
            'user_id' => UserFactory::new(),
            'parent_comment_id' => null,
            'body' => fake()->sentence(),
            'removed_at' => null,
        ];
    }

    public function reply(): static
    {
        return $this->state(fn (array $attrs) => [
            'parent_comment_id' => CommentFactory::new(),
        ]);
    }

    public function removed(): static
    {
        return $this->state(fn (array $attrs) => ['removed_at' => now()]);
    }
}
