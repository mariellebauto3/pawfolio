<?php

declare(strict_types=1);

namespace App\Http\Requests\Auth;

use App\Enums\IdType;
use App\Support\PasswordRules;
use App\Support\Provinces;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

class SignUpHumanRequest extends FormRequest
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

        foreach (['full_name', 'birthdate', 'contact_number', 'city', 'province', 'street_address', 'id_type'] as $field) {
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
        $idTypes = array_map(fn (IdType $case) => $case->value, IdType::cases());

        return [
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'password' => PasswordRules::rules(),
            'full_name' => ['required', 'string', 'max:120'],
            'birthdate' => [
                'required',
                'string',
                function (string $attribute, mixed $value, Closure $fail): void {
                    self::validateBirthdate((string) $value, $fail);
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
            'id_type' => ['required', 'string', Rule::in($idTypes)],
            'valid_id' => ['required', 'file'],
            'terms_accepted' => ['required', 'accepted'],
        ];
    }

    public static function validateBirthdate(string $birthdate, Closure $fail): void
    {
        if (preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $birthdate, $matches) !== 1) {
            $fail('Enter a valid birthdate.');

            return;
        }

        $year = (int) $matches[1];
        $month = (int) $matches[2];
        $day = (int) $matches[3];

        if (! checkdate($month, $day, $year)) {
            $fail('Enter a valid birthdate.');

            return;
        }

        $dob = Carbon::createFromDate($year, $month, $day)->startOfDay();
        $today = Carbon::now()->startOfDay();

        if ($dob->greaterThan($today)) {
            $fail('Enter a valid birthdate.');

            return;
        }

        $age = (int) $dob->diffInYears($today);
        if ($age > 120) {
            $fail('Enter a valid birthdate.');

            return;
        }

        if ($age < 18) {
            $fail('You must be 18 or older to adopt on Pawfolio.');
        }
    }

    public function messages(): array
    {
        return array_merge(
            PasswordRules::messages(),
            [
                'email.required' => 'Enter your email.',
                'email.email' => 'Enter a valid email address.',
                'email.unique' => 'An account with this email already exists. Sign in, or use a different email.',
                'full_name.required' => 'Enter your full name.',
                'birthdate.required' => 'Enter your birthdate.',
                'contact_number.required' => 'Enter a mobile number.',
                'city.required' => 'Enter the city.',
                'province.required' => 'Choose a province.',
                'province.in' => 'Choose a province.',
                'street_address.required' => 'Enter your street address.',
                'id_type.required' => 'Choose the type of ID.',
                'id_type.in' => 'Choose the type of ID.',
                'valid_id.required' => 'Upload a photo of the valid ID.',
                'valid_id.file' => 'Upload a JPG, PNG or PDF file.',
                'terms_accepted.required' => 'Confirm the details and agree to the Terms and Community Guidelines to continue.',
                'terms_accepted.accepted' => 'Confirm the details and agree to the Terms and Community Guidelines to continue.',
            ],
        );
    }
}
