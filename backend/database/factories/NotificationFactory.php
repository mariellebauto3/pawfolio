<?php

namespace Database\Factories;

use App\Models\Notification;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Notification> */
class NotificationFactory extends Factory
{
    protected $model = Notification::class;

    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'type' => 'request_received',
            'title' => fake()->sentence(3),
            'body' => fake()->paragraph(),
            'urgency' => 'info',
        ];
    }

    public function read(): static
    {
        return $this->state(fn (array $attrs) => [
            'read_at' => now(),
        ]);
    }

    public function dismissed(): static
    {
        return $this->state(fn (array $attrs) => [
            'dismissed_at' => now(),
        ]);
    }
}
