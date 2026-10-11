<?php

declare(strict_types=1);

namespace App\Http\Requests\AdoptionRequests;

use App\Enums\AdoptionRequestWithdrawReason;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * The body of `POST /adoption-requests/{id}/withdraw` (RQ-16, FR25): the optional reason, one of the four the dialog
 * lists. Whose request it is, is checked on the record itself by the controller (AdoptionRequestPolicy).
 */
class WithdrawAdoptionRequestRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** No choice made is sent as nothing at all or as an empty value; both are no reason. */
    protected function prepareForValidation(): void
    {
        if ($this->input('withdraw_reason') === '') {
            $this->merge(['withdraw_reason' => null]);
        }
    }

    public function rules(): array
    {
        return [
            'withdraw_reason' => ['nullable', 'string', Rule::enum(AdoptionRequestWithdrawReason::class)],
        ];
    }

    public function messages(): array
    {
        return [
            'withdraw_reason.*' => 'Choose a reason from the list, or leave it out.',
        ];
    }

    public function reason(): ?string
    {
        return $this->validated('withdraw_reason');
    }
}
