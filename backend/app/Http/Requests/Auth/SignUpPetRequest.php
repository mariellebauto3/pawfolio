<?php

declare(strict_types=1);

namespace App\Http\Requests\Auth;

use App\Support\PasswordRules;
use App\Support\Provinces;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SignUpPetRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $merged = [];

        if (is_string($this->input('email'))) {
            $merged['email'] = mb_strtolower(trim($this->input('email')));
        }

        foreach (['name', 'breed', 'currently_at', 'city', 'province', 'caretaker_name', 'caretaker_contact_number'] as $field) {
            if (is_string($this->input($field))) {
                $merged[$field] = trim($this->input($field));
            }
        }

        if (! empty($merged)) {
            $this->merge($merged);
        }
    }

    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'password' => PasswordRules::rules(),
            'name' => ['required', 'string', 'max:50'],
            'species' => ['required', 'string', Rule::in(['dog', 'cat', 'other'])],
            'breed' => ['required', 'string', 'max:80'],
            'approximate_age_months' => [
                'required',
                'integer',
                'min:1',
                'max:360',
            ],
            'currently_at' => ['required', 'string', 'max:120'],
            'city' => ['required', 'string', 'max:80'],
            'province' => ['required', 'string', Rule::in(Provinces::LIST)],
            'photos' => ['required', 'array', 'min:1', 'max:3'],
            'photos.*' => ['required', 'file'],
            'caretaker_name' => ['required', 'string', 'max:120'],
            'caretaker_contact_number' => [
                'required',
                'string',
                function (string $attribute, mixed $value, Closure $fail): void {
                    if (Provinces::normalizeContactNumber((string) $value) === null) {
                        $fail('Enter a mobile number like 0917 123 4567.');
                    }
                },
            ],
            'valid_id' => ['required', 'file'],
            'vet_record' => ['nullable', 'file'],
            'terms_accepted' => ['required', 'accepted'],
        ];
    }

    public function messages(): array
    {
        return array_merge(
            PasswordRules::messages(),
            [
                'email.required' => 'Enter your email.',
                'email.email' => 'Enter a valid email address.',
                'email.unique' => 'An account with this email already exists. Sign in, or use a different email.',
                'name.required' => "Enter the pet's name.",
                'species.required' => 'Choose a species.',
                'species.in' => 'Choose a species.',
                'breed.required' => 'Enter the breed, or "Mixed" if you\'re not sure.',
                'approximate_age_months.required' => "Enter the pet's approximate age.",
                'approximate_age_months.integer' => 'Enter a whole number, 1 or more. Use months for a pet under a year old.',
                'approximate_age_months.min' => 'Enter a whole number, 1 or more. Use months for a pet under a year old.',
                'approximate_age_months.max' => 'Enter an age of 30 years or less.',
                'currently_at.required' => 'Enter where the pet is staying.',
                'city.required' => 'Enter the city.',
                'province.required' => 'Choose a province.',
                'province.in' => 'Choose a province.',
                'photos.required' => 'Add at least one clear photo of the pet.',
                'photos.array' => 'Add at least one clear photo of the pet.',
                'photos.min' => 'Add at least one clear photo of the pet.',
                'photos.max' => 'Add up to 3 photos.',
                'caretaker_name.required' => "Enter the caretaker's full name.",
                'caretaker_contact_number.required' => 'Enter a mobile number.',
                'valid_id.required' => 'Upload a photo of the valid ID.',
                'valid_id.file' => 'Upload a JPG, PNG or PDF file.',
                'terms_accepted.required' => 'Confirm the details and agree to the Terms and Community Guidelines to continue.',
                'terms_accepted.accepted' => 'Confirm the details and agree to the Terms and Community Guidelines to continue.',
            ],
        );
    }
}
