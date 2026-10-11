<?php

declare(strict_types=1);

namespace App\Http\Requests\Auth;

use App\Enums\DenialReason;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * The body of `POST /admin/verifications/{accountId}/deny` (AU-25). Only the two fields below are read; `status`,
 * `reviewed_by` and anything else are ignored (SEC-INPUT-04, SEC-AUTHZ-05).
 */
class DenyVerificationRequest extends FormRequest
{
    public const MESSAGE_MAX = 500;

    /** Admin only: the route's `role:admin` middleware has already checked (SEC-AUTHZ-07). */
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $message = $this->input('message_to_owner');
        if (is_string($message)) {
            $message = trim($message);
            $this->merge(['message_to_owner' => $message === '' ? null : $message]);
        }
    }

    public function rules(): array
    {
        $reasons = array_map(fn (DenialReason $reason) => $reason->value, DenialReason::cases());

        return [
            // A denial always needs a reason (FR33, SEC-AUTHZ-07).
            'denial_reason' => ['required', 'string', Rule::in($reasons)],
            // "Other" says nothing on its own, so it also needs the message the owner will read.
            'message_to_owner' => ['nullable', 'string', 'max:'.self::MESSAGE_MAX, 'required_if:denial_reason,'.DenialReason::Other->value],
        ];
    }

    public function messages(): array
    {
        return [
            'denial_reason.required' => 'Choose a reason.',
            'denial_reason.string' => 'Choose a reason.',
            'denial_reason.in' => 'Choose a reason.',
            'message_to_owner.required_if' => 'Write a message so the owner knows what to correct.',
            'message_to_owner.string' => 'Write a message so the owner knows what to correct.',
            'message_to_owner.max' => 'Keep the message to '.self::MESSAGE_MAX.' characters or fewer.',
        ];
    }

    public function reason(): DenialReason
    {
        return DenialReason::from($this->validated('denial_reason'));
    }

    public function messageToOwner(): ?string
    {
        return $this->validated('message_to_owner');
    }
}
