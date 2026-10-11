<?php

namespace Database\Factories;

use App\Enums\DetailChangeRequestStatus;
use App\Models\DetailChangeRequest;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<DetailChangeRequest>
 */
class DetailChangeRequestFactory extends Factory
{
    protected $model = DetailChangeRequest::class;

    public function definition(): array
    {
        return [
            'user_id' => UserFactory::new(),
            'field' => 'full_name',
            'new_value' => fake()->name(),
            'reason' => fake()->sentence(),
            'document_path' => null,
            'status' => DetailChangeRequestStatus::Pending->value,
            'reviewed_by_user_id' => null,
            'reviewed_at' => null,
        ];
    }

    public function pending(): static
    {
        return $this->state(fn (array $attrs) => ['status' => DetailChangeRequestStatus::Pending->value]);
    }

    public function approved(): static
    {
        return $this->state(fn (array $attrs) => [
            'status' => DetailChangeRequestStatus::Approved->value,
            'reviewed_by_user_id' => UserFactory::new(),
            'reviewed_at' => now(),
        ]);
    }

    public function denied(): static
    {
        return $this->state(fn (array $attrs) => [
            'status' => DetailChangeRequestStatus::Denied->value,
            'reviewed_by_user_id' => UserFactory::new(),
            'reviewed_at' => now(),
        ]);
    }
}
