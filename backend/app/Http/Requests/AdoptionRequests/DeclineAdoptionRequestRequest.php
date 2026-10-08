<?php

declare(strict_types=1);

namespace App\Http\Requests\AdoptionRequests;

use App\Enums\AdoptionRequestDeclineReason;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * The body of `POST /adoption-requests/{id}/decline` (RQ-13, FR10): the optional reason, one of the four the dialog
 * lists, and the optional message to the pet. Whose request it is, is checked on the record itself by the controller
 * (AdoptionRequestPolicy).
 */
class DeclineAdoptionRequestRequest extends FormRequest
{
    public const MESSAGE_MAX = 600;

    public function authorize(): bool
    {
        return true;
    }

    /** No choice made is sent as nothing at all or as an empty value; an empty message is no message. */
    protected function prepareForValidation(): void
    {
        $merged = [];
        if ($this->input('decline_reason') === '') {
            $merged['decline_reason'] = null;
        }
        $message = $this->input('decision_message');
        if (is_string($message)) {
            $message = trim($message);
            $merged['decision_message'] = $message === '' ? null : $message;
        }
        $this->merge($merged);
    }

    public function rules(): array
    {
        return [
            'decline_reason' => ['nullable', 'string', Rule::enum(AdoptionRequestDeclineReason::class)],
            'decision_message' => ['nullable', 'string', 'max:'.self::MESSAGE_MAX],
        ];
    }

    public function messages(): array
    {
        return [
            'decline_reason.*' => 'Choose a reason from the list, or leave it out.',
            'decision_message.*' => 'Keep the message to '.self::MESSAGE_MAX.' characters or fewer.',
        ];
    }

    public function reason(): ?string
    {
        return $this->validated('decline_reason');
    }

    public function message(): ?string
    {
        return $this->validated('decision_message');
    }
}
