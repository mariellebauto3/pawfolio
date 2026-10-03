<?php

namespace Database\Factories;

use App\Models\PostPhoto;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PostPhoto>
 */
class PostPhotoFactory extends Factory
{
    protected $model = PostPhoto::class;

    public function definition(): array
    {
        return [
            'post_id' => PostFactory::new()->sequence(fn (array $attrs) => $attrs['post_id'] ?? null),
            'file_path' => 'posts/' . bin2hex(fake()->hexify(16)) . '.' . fake()->randomElement(['jpg', 'png']),
            'sort_order' => 1,
        ];
    }
}
