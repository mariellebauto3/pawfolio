<?php

declare(strict_types=1);

namespace App\Http\Requests\Auth;

use App\Enums\IdType;
use App\Support\Provinces;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateSubmissionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $merged = [];

        foreach ([
            'name', 'breed', 'currently_at', 'city', 'province',
            'caretaker_name', 'caretaker_contact_number',
            'full_name', 'birthdate', 'contact_number', 'street_address', 'id_type',
        ] as $field) {
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
        $user = $this->user();
        if ($user && $user->isPet()) {
            return [
                'name' => ['required', 'string', 'max:50'],
                'species' => ['required', 'string', Rule::in(['dog', 'cat', 'other'])],
                'breed' => ['required', 'string', 'max:80'],
                'approximate_age_months' => ['required', 'integer', 'min:1', 'max:360'],
                'currently_at' => ['required', 'string', 'max:120'],
                'city' => ['required', 'string', 'max:80'],
                'province' => ['required', 'string', Rule::in(Provinces::LIST)],
                'photos' => ['nullable', 'array', 'max:3'],
                'photos.*' => ['file'],
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
                'valid_id' => ['nullable', 'file'],
                'vet_record' => ['nullable', 'file'],
            ];
        }

        $idTypes = array_map(fn (IdType $case) => $case->value, IdType::cases());

        return [
            'full_name' => ['required', 'string', 'max:120'],
            'birthdate' => [
                'required',
                'string',
                function (string $attribute, mixed $value, Closure $fail): void {
                    SignUpHumanRequest::validateBirthdate((string) $value, $fail);
                },
            ],
            'contact_number' => [
                'required',
                'string',
                function (string $attribute, mixed $value, Closure $fail): void {
                    if (Provinces::normalizeContactNumber((string) $value) === null) {
                        $fail('Enter a mobile number like 0917 123 4567.');
                    }
                },
            ],
            'city' => ['required', 'string', 'max:80'],
            'province' => ['required', 'string', Rule::in(Provinces::LIST)],
            'street_address' => ['required', 'string', 'max:255'],
            // Still required when the ID file is left out: it describes the ID on file (docs/api/auth.md).
            'id_type' => ['required', 'string', Rule::in($idTypes)],
            'valid_id' => ['nullable', 'file'],
        ];
    }

    public function messages(): array
    {
        return [
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
            'photos.max' => 'Add up to 3 photos.',
            'caretaker_name.required' => "Enter the caretaker's full name.",
            'caretaker_contact_number.required' => 'Enter a mobile number.',
            'full_name.required' => 'Enter your full name.',
            'birthdate.required' => 'Enter your birthdate.',
            'contact_number.required' => 'Enter a mobile number.',
            'street_address.required' => 'Enter your street address.',
            'id_type.required' => 'Choose the type of ID.',
            'id_type.in' => 'Choose the type of ID.',
        ];
    }
}
