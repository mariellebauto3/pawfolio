<?php

declare(strict_types=1);

namespace App\Support;

use Illuminate\Validation\Rules\Password;

/**
 * Shared password rules and messages (SEC-AUTH-03, AU-06, AU-08, AU-13, AC-04).
 */
final class PasswordRules
{
    public static function rules(bool $checkUncompromised = true): array
    {
        $rule = Password::min(8)->letters()->numbers();

        if ($checkUncompromised) {
            $rule = $rule->uncompromised();
        }

        return [
            'required',
            'string',
            'max:255',
            'confirmed',
            $rule,
        ];
    }

    /**
     * @return array<string, string>
     */
    public static function messages(string $field = 'password', string $requiredMessage = 'Enter a password.'): array
    {
        return [
            "{$field}.required" => $requiredMessage,
            "{$field}.confirmed" => "The passwords don't match.",
            "{$field}.min" => 'Use at least 8 characters.',
            "{$field}.letters" => 'Include at least one letter.',
            "{$field}.numbers" => 'Include at least one number.',
            "{$field}.uncompromised" => 'This password has appeared in a data leak. Choose a different one.',
        ];
    }
}
