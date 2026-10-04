<?php

namespace Database\Factories;

use App\Enums\AccountAction as AccountActionEnum;
use App\Models\AccountAction;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<AccountAction>
 */
class AccountActionFactory extends Factory
{
    protected $model = AccountAction::class;

    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'performed_by_user_id' => null,
            'action' => AccountActionEnum::Deactivate->value,
            'reason' => null,
        ];
    }

    public function selfDeactivation(): static
    {
        return $this->state(fn () => [
            'action' => AccountActionEnum::Deactivate->value,
            'performed_by_user_id' => null,
            'reason' => 'I no longer wish to use Pawfolio',
        ]);
    }

    public function suspended(): static
    {
        return $this->state(fn () => [
            'action' => AccountActionEnum::Suspend->value,
            'performed_by_user_id' => User::factory()->adminAccount(),
            'reason' => fake()->sentence(),
        ]);
    }

    public function reactivated(): static
    {
        return $this->state(fn () => [
            'action' => AccountActionEnum::Reactivate->value,
            'performed_by_user_id' => User::factory()->adminAccount(),
            'reason' => fake()->sentence(),
        ]);
    }
}
