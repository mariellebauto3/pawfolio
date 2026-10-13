<?php

namespace App\Rules;

use App\Models\User;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

class UniqueEmail implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (User::whereRaw('LOWER(email) = ?', [mb_strtolower(trim((string) $value))])->exists()) {
            $fail('An account with this email already exists. Sign in, or use a different email.');
        }
    }
}
