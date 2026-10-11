<?php

namespace Database\Factories;

use App\Enums\ActivityLogType;
use App\Models\ActivityLog;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ActivityLog>
 */
class ActivityLogFactory extends Factory
{
    protected $model = ActivityLog::class;

    public function definition(): array
    {
        return [
            'actor_user_id' => UserFactory::new(),
            'type' => ActivityLogType::System->value,
            'action' => 'Example action',
            'subject_type' => null,
            'subject_id' => null,
            'before_value' => null,
            'after_value' => null,
            'reason' => null,
            'user_agent' => null,
        ];
    }

    public function verification(): static
    {
        return $this->state(fn (array $attrs) => [
            'type' => ActivityLogType::Verification->value,
            'action' => 'verified',
            'subject_type' => 'App\\Models\\User',
            'subject_id' => UserFactory::new(),
            'before_value' => null,
            'after_value' => 'active',
            'reason' => 'Admin approved the verification submission',
        ]);
    }

    public function account(): static
    {
        return $this->state(fn (array $attrs) => [
            'type' => ActivityLogType::Account->value,
            'action' => 'changed password',
            'subject_type' => 'App\\Models\\User',
            'subject_id' => UserFactory::new(),
            'before_value' => null,
            'after_value' => null,
            'reason' => null,
            'user_agent' => 'Mozilla/5.0 test-agent',
        ]);
    }

    public function statusChange(): static
    {
        return $this->state(fn (array $attrs) => [
            'type' => ActivityLogType::StatusChange->value,
            'action' => 'status changed',
            'subject_type' => 'App\\Models\\User',
            'subject_id' => UserFactory::new(),
            'before_value' => 'pending_verification',
            'after_value' => 'active',
            'reason' => 'Admin approved',
        ]);
    }
}
