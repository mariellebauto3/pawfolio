<?php

declare(strict_types=1);

namespace App\Http\Requests\MeetAndGreet;

use Illuminate\Foundation\Http\FormRequest;

/**
 * The body of a pet's `POST /adoption-requests/{id}/meet-and-greet` (MG-03) and `…/reschedule` (MG-04, MG-09,
 * FR26): the slot it picks, and for a reschedule the optional reason the human reads. Whose request it is, and
 * whether the slot can still be taken, are checked on the records by the controller.
 */
class ChooseMeetGreetSlotRequest extends FormRequest
{
    public const REASON_MAX = 600;

    public function authorize(): bool
    {
        return true;
    }

    /** `meet_greet_slot_id` is the column name and is read as `slot_id`; an empty reason is no reason. */
    protected function prepareForValidation(): void
    {
        $merged = [];
        if ($this->input('slot_id') === null && $this->input('meet_greet_slot_id') !== null) {
            $merged['slot_id'] = $this->input('meet_greet_slot_id');
        }
        $reason = $this->input('reason');
        if (is_string($reason)) {
            $reason = trim($reason);
            $merged['reason'] = $reason === '' ? null : $reason;
        }
        $this->merge($merged);
    }

    public function rules(): array
    {
        return [
            'slot_id' => ['required', 'integer', 'min:1'],
            'reason' => ['sometimes', 'nullable', 'string', 'max:'.self::REASON_MAX],
        ];
    }

    public function messages(): array
    {
        return [
            'slot_id.*' => 'Choose one of the open slots.',
            'reason.*' => 'Keep the reason to '.self::REASON_MAX.' characters or fewer.',
        ];
    }

    public function slotId(): int
    {
        return (int) $this->validated('slot_id');
    }

    public function reason(): ?string
    {
        return $this->validated('reason');
    }
}
