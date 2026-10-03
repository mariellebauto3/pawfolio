<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

class ResetPasswordRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Public endpoint: the single-use, 30-minute token is the proof (SEC-AUTH-08).
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('email'))) {
            $this->merge(['email' => mb_strtolower(trim($this->input('email')))]);
        }
    }

    public function rules(): array
    {
        return [
            'token' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255'],
            // SEC-AUTH-03 (AU-06): 8+ characters with a letter and a number, and not a known breached password.
            'password' => ['required', 'string', 'max:255', 'confirmed', Password::min(8)->letters()->numbers()->uncompromised()],
        ];
    }

    public function messages(): array
    {
        return [
            'password.required' => 'Enter a new password.',
            'password.confirmed' => "The passwords don't match.",
            'password.min' => 'Use at least 8 characters.',
            'password.letters' => 'Include at least one letter.',
            'password.numbers' => 'Include at least one number.',
            'password.uncompromised' => 'This password has appeared in a data leak. Choose a different one.',
        ];
    }
}
