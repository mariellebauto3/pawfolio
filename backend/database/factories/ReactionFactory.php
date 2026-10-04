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
            'user_id' => UserFactory::new(),
            'post_id' => PostFactory::new(),
            'comment_id' => CommentFactory::new(),
        ];
    }

    public function onPost(): static
    {
        return $this->state(fn (array $attrs) => [
            'post_id' => PostFactory::new(),
            'comment_id' => null,
        ]);
    }

    public function onComment(): static
    {
        return $this->state(fn (array $attrs) => [
            'post_id' => null,
            'comment_id' => CommentFactory::new(),
        ]);
    }
}
