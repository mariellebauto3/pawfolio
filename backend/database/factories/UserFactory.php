<?php

namespace Database\Factories;

use App\Enums\AccountStatus;
use App\Enums\Role;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<User> */
class UserFactory extends Factory
{
    protected $model = User::class;

    protected static ?string $password;

    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'email_verified_at' => now(),
            'password' => static::$password ??= bcrypt('password'),
            'remember_token' => Str::random(10),
            // role + status are system-set only (FR27, SEC-INPUT-04); the
            // factory's default is a working active human account for tests.
            'role' => Role::Human->value,
            'status' => AccountStatus::Active->value,
        ];
    }

    public function petAccount(): static
    {
        return $this->state(fn (array $attrs) => [
            'role' => Role::Pet->value,
            'status' => AccountStatus::Active->value,
        ]);
    }

    public function humanAccount(): static
    {
        return $this->state(fn (array $attrs) => [
            'role' => Role::Human->value,
            'status' => AccountStatus::Active->value,
        ]);
    }

    public function adminAccount(): static
    {
        return $this->state(fn (array $attrs) => [
            'role' => Role::Admin->value,
            'status' => AccountStatus::Active->value,
        ]);
    }

    public function pendingVerification(): static
    {
        return $this->state(fn (array $attrs) => [
            'role' => Role::Human->value,
            'status' => AccountStatus::PendingVerification->value,
        ]);
    }

    public function denied(): static
    {
        return $this->state(fn (array $attrs) => [
            'role' => Role::Human->value,
            'status' => AccountStatus::Denied->value,
        ]);
    }

    public function suspended(): static
    {
        return $this->state(fn (array $attrs) => [
            'role' => Role::Human->value,
            'status' => AccountStatus::Suspended->value,
        ]);
    }

    public function deactivated(): static
    {
        return $this->state(fn (array $attrs) => [
            'role' => Role::Human->value,
            'status' => AccountStatus::Deactivated->value,
        ]);
    }
}
