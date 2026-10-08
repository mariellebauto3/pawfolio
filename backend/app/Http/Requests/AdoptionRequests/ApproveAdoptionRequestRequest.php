<?php

declare(strict_types=1);

namespace App\Http\Requests\AdoptionRequests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * The body of `POST /adoption-requests/{id}/approve` (RQ-12, FR10): the optional message to the pet. Whose request it
 * is, is checked on the record itself by the controller (AdoptionRequestPolicy); the new status is the system's
 * (SEC-INPUT-04).
 */
class ApproveAdoptionRequestRequest extends FormRequest
{
    public const MESSAGE_MAX = 600;

    public function authorize(): bool
    {
        return true;
    }

    /** Trimmed before it is counted (SEC-INPUT-06); an empty message is no message. */
    protected function prepareForValidation(): void
    {
        $message = $this->input('approval_message');
        if (is_string($message)) {
            $message = trim($message);
            $this->merge(['approval_message' => $message === '' ? null : $message]);
        }
    }

    public function rules(): array
    {
        return [
            'approval_message' => ['nullable', 'string', 'max:'.self::MESSAGE_MAX],
        ];
    }

    public function messages(): array
    {
        return [
            'approval_message.*' => 'Keep the message to '.self::MESSAGE_MAX.' characters or fewer.',
        ];
    }

    public function message(): ?string
    {
        return $this->validated('approval_message');
    }
}
