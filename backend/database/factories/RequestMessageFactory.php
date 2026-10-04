<?php

namespace Database\Factories;

use App\Models\RequestMessage;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<RequestMessage>
 */
class RequestMessageFactory extends Factory
{
    protected $model = RequestMessage::class;

    public function definition(): array
    {
        return [
            'adoption_request_id' => AdoptionRequestFactory::new(),
            'sender_user_id' => UserFactory::new(),
            'body' => fake()->sentence(),
        ];
    }
}
