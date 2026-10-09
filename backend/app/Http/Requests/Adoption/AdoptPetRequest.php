<?php

declare(strict_types=1);

namespace App\Http\Requests\Adoption;

use Illuminate\Foundation\Http\FormRequest;

/**
 * The body of `POST /adoption-requests/{id}/adopt` (AL-01, FR12): nothing is required. An optional message to the pet
 * is kept with the request; the screens send none. Whose request it is, and whether the meeting time has passed, are
 * checked on the record itself by the controller (AdoptionRequestPolicy).
 */
class AdoptPetRequest extends FormRequest
{
    public const MESSAGE_MAX = 600;

    public function authorize(): bool
    {
        return true;
    }

    /** An empty message is no message. */
    protected function prepareForValidation(): void
    {
        $message = $this->input('decision_message');
        if (is_string($message)) {
            $message = trim($message);
            $this->merge(['decision_message' => $message === '' ? null : $message]);
        }
    }

    public function rules(): array
    {
        return [
            'decision_message' => ['nullable', 'string', 'max:'.self::MESSAGE_MAX],
        ];
    }

    public function messages(): array
    {
        return [
            'decision_message.*' => 'Keep the message to '.self::MESSAGE_MAX.' characters or fewer.',
        ];
    }

    public function message(): ?string
    {
        return $this->validated('decision_message');
    }
}
