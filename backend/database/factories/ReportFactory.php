<?php

namespace Database\Factories;

use App\Enums\ReportReason;
use App\Enums\ReportStatus;
use App\Enums\ReportTargetType;
use App\Models\Report;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Report>
 */
class ReportFactory extends Factory
{
    protected $model = Report::class;

    public function definition(): array
    {
        return [
            'reporter_user_id' => UserFactory::new(),
            'target_type' => ReportTargetType::Profile->value,
            'reported_user_id' => UserFactory::new(),
            'post_id' => null,
            'comment_id' => null,
            'reason' => ReportReason::SomethingElse->value,
            'details' => fake()->optional()->sentence(),
            'status' => ReportStatus::Open->value,
            'report_action_id' => null,
        ];
    }

    public function onPost(): static
    {
        return $this->state(fn (array $attrs) => [
            'target_type' => ReportTargetType::Post->value,
            'post_id' => PostFactory::new(),
            'comment_id' => null,
        ]);
    }

    public function onComment(): static
    {
        return $this->state(fn (array $attrs) => [
            'target_type' => ReportTargetType::Comment->value,
            'post_id' => null,
            'comment_id' => CommentFactory::new(),
        ]);
    }

    public function onAccount(): static
    {
        return $this->state(fn (array $attrs) => [
            'target_type' => ReportTargetType::Account->value,
            'post_id' => null,
            'comment_id' => null,
        ]);
    }

    public function resolved(): static
    {
        return $this->state(fn (array $attrs) => [
            'status' => ReportStatus::Resolved->value,
            'report_action_id' => ReportActionFactory::new(),
        ]);
    }
}
