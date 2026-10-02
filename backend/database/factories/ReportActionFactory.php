<?php

namespace Database\Factories;

use App\Enums\ReportAction as ReportActionEnum;
use App\Models\ReportAction;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ReportAction>
 */
class ReportActionFactory extends Factory
{
    protected $model = ReportAction::class;

    public function definition(): array
    {
        return [
            'admin_user_id' => UserFactory::new()->sequence(fn (array $attrs) => $attrs['admin_user_id'] ?? null),
            'target_type' => ReportTargetType::Profile->value,
            'reported_user_id' => UserFactory::new()->sequence(fn (array $attrs) => $attrs['reported_user_id'] ?? null),
            'post_id' => null,
            'comment_id' => null,
            'action' => ReportActionEnum::RemoveContent->value,
            'reason' => fake()->sentence(),
            'notify_reporters' => true,
        ];
    }

    public function removeContent(): static
    {
        return $this->state(fn (array $attrs) => [
            'action' => ReportActionEnum::RemoveContent->value,
            'reason' => fake()->sentence(),
        ]);
    }

    public function suspendAccount(): static
    {
        return $this->state(fn (array $attrs) => [
            'action' => ReportActionEnum::SuspendAccount->value,
            'reason' => fake()->sentence(),
        ]);
    }

    public function removeContentAndSuspend(): static
    {
        return $this->state(fn (array $attrs) => [
            'action' => ReportActionEnum::RemoveContentAndSuspend->value,
            'reason' => fake()->sentence(),
        ]);
    }

    public function dismiss(): static
    {
        return $this->state(fn (array $attrs) => [
            'action' => ReportActionEnum::Dismiss->value,
            'reason' => 'No policy violation found',
        ]);
    }
}
