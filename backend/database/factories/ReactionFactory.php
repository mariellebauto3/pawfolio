<?php

namespace Database\Factories;

use App\Models\Reaction;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Reaction>
 */
class ReactionFactory extends Factory
{
    protected $model = Reaction::class;

    public function definition(): array
    {
        return [
            'user_id' => UserFactory::new()->sequence(fn (array $attrs) => $attrs['user_id'] ?? null),
            'post_id' => PostFactory::new()->sequence(fn (array $attrs) => $attrs['post_id'] ?? null),
            'comment_id' => CommentFactory::new()->sequence(fn (array $attrs) => $attrs['comment_id'] ?? null),
        ];
    }

    public function onPost(): static
    {
        return $this->state(fn (array $attrs) => [
            'post_id' => PostFactory::new()->sequence(fn (array $attrs) => $attrs['post_id'] ?? null),
            'comment_id' => null,
        ]);
    }

    public function onComment(): static
    {
        return $this->state(fn (array $attrs) => [
            'post_id' => null,
            'comment_id' => CommentFactory::new()->sequence(fn (array $attrs) => $attrs['comment_id'] ?? null),
        ]);
    }
}
