<?php

namespace Database\Factories;

use App\Enums\AnnouncementAudience;
use App\Models\Announcement;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Announcement>
 */
class AnnouncementFactory extends Factory
{
    protected $model = Announcement::class;

    public function definition(): array
    {
        return [
            'admin_user_id' => UserFactory::new(),
            'title' => fake()->sentence(),
            'message' => fake()->paragraph(),
            'audience' => AnnouncementAudience::Everyone->value,
            'publish_at' => now()->addMinutes(fake()->numberBetween(0, 1440)),
            'published_at' => null,
        ];
    }

    public function published(): static
    {
        return $this->state(fn (array $attrs) => [
            'published_at' => now(),
        ]);
    }

    public function petsOnly(): static
    {
        return $this->state(fn (array $attrs) => [
            'audience' => AnnouncementAudience::Pets->value,
        ]);
    }

    public function humansOnly(): static
    {
        return $this->state(fn (array $attrs) => [
            'audience' => AnnouncementAudience::Humans->value,
        ]);
    }
}
