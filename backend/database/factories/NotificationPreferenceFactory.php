<?php

namespace Database\Factories;

use App\Models\NotificationPreference;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<NotificationPreference>
 */
class NotificationPreferenceFactory extends Factory
{
    protected $model = NotificationPreference::class;

    public function definition(): array
    {
        return [
            'user_id' => UserFactory::new(),
            'requests_and_invites' => true,
            'meet_and_greets' => true,
            'post_activity' => true,
            'announcements' => true,
        ];
    }

    public function muted(): static
    {
        return $this->state(fn (array $attrs) => [
            'requests_and_invites' => false,
            'meet_and_greets' => false,
            'post_activity' => false,
            'announcements' => false,
        ]);
    }
}
