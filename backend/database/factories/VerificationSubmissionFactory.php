<?php

namespace Database\Factories;

use App\Enums\VerificationSubmissionStatus;
use App\Models\VerificationSubmission;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<VerificationSubmission>
 */
class VerificationSubmissionFactory extends Factory
{
    protected $model = VerificationSubmission::class;

    public function definition(): array
    {
        return [
            'user_id' => UserFactory::new(),
            'status' => VerificationSubmissionStatus::Pending->value,
            'submitted_at' => now(),
            'reviewed_by_user_id' => null,
            'reviewed_at' => null,
            'denial_reason' => null,
            'message_to_owner' => null,
        ];
    }

    public function pending(): static
    {
        return $this->state(fn (array $attrs) => ['status' => VerificationSubmissionStatus::Pending->value]);
    }

    public function approved(): static
    {
        return $this->state(fn (array $attrs) => [
            'status' => VerificationSubmissionStatus::Approved->value,
            'reviewed_by_user_id' => UserFactory::new(),
            'reviewed_at' => now(),
        ]);
    }

    public function denied(): static
    {
        return $this->state(fn (array $attrs) => [
            'status' => VerificationSubmissionStatus::Denied->value,
            'reviewed_by_user_id' => UserFactory::new(),
            'reviewed_at' => now(),
            'denial_reason' => fake()->randomElement(['id_photo_unreadable', 'name_mismatch', 'id_expired', 'under_18', 'other']),
            'message_to_owner' => fake()->sentence(),
        ]);
    }
}
