<?php

namespace Database\Factories;

use App\Models\Post;
use App\Models\PostPhoto;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<PostPhoto>
 */
class PostPhotoFactory extends Factory
{
    protected $model = PostPhoto::class;

    public function definition(): array
    {
        return [
            'post_id' => Post::factory(),
            'file_path' => 'posts/'.Str::uuid()->toString().'.jpg',
            'sort_order' => 1,
        ];
    }
}
