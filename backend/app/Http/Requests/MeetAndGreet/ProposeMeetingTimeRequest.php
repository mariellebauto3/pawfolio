<?php

declare(strict_types=1);

namespace App\Http\Requests\MeetAndGreet;

use Illuminate\Foundation\Http\FormRequest;

/**
 * The body of a human's `POST /adoption-requests/{id}/meet-and-greet/propose-time` (MG-06, FR11): one of their own
 * open slots to offer instead, and an optional message to the pet. A new time is added as a slot first
 * (`POST /meet-greet-slots`), so every slot passes the same checks.
 */
class ProposeMeetingTimeRequest extends FormRequest
{
    public const MESSAGE_MAX = 600;

    public function authorize(): bool
    {
        return true;
    }

    /** `slot_id` is read as `proposed_slot_id`; an empty message is no message. */
    protected function prepareForValidation(): void
    {
        $merged = [];
        if ($this->input('proposed_slot_id') === null && $this->input('slot_id') !== null) {
            $merged['proposed_slot_id'] = $this->input('slot_id');
        }
        $message = $this->input('message');
        if (is_string($message)) {
            $message = trim($message);
            $merged['message'] = $message === '' ? null : $message;
        }
        $this->merge($merged);
    }

    public function rules(): array
    {
        return [
            'proposed_slot_id' => ['required', 'integer', 'min:1'],
            'message' => ['sometimes', 'nullable', 'string', 'max:'.self::MESSAGE_MAX],
        ];
    }

    public function messages(): array
    {
        return [
            'proposed_slot_id.*' => 'Choose one of your open slots.',
            'message.*' => 'Keep the message to '.self::MESSAGE_MAX.' characters or fewer.',
        ];
    }

    public function slotId(): int
    {
        return (int) $this->validated('proposed_slot_id');
    }

    public function message(): ?string
    {
        return $this->validated('message');
    }
}
