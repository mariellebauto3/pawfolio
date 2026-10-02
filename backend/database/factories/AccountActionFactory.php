<?php

namespace Database\Factories;

use App\Enums\AccountAction as AccountActionEnum;
use App\Models\AccountAction;
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
            'user_id' => UserFactory::new()->sequence(fn (array $attrs) => $attrs['user_id'] ?? null),
            'performed_by_user_id' => null,
            'action' => AccountAction::Deactivate->value,
            'reason' => null,
        ];
    }

    public function selfDeactivation(): static
    {
        return $this->state(fn (array $attrs) => ['action' => AccountActionEnum::Deactivate->value, 'performed_by_user_id' => null, 'reason' => 'I no longer wish to use Pawfolio',
        ]);
    }

    public function suspended(): static
    {
        return $this->state(fn (array $attrs) => [
            'action' => AccountActionEnum::Suspend->value,
            'performed_by_user_id' => UserFactory::new()->sequence(fn (array $attrs) => $attrs['performed_by_user_id'] ?? null),
            'reason' => fake()->sentence(),
        ]);
    }

    public function reactivated(): static
    {
        return $this->state(fn (array $attrs) => [
            'action' => AccountActionEnum::Reactivate->value,
            'performed_by_user_id' => UserFactory::new()->sequence(fn (array $attrs) => $attrs['performed_by_user_id'] ?? null),
            'reason' => null,
        ]);
    }
}
