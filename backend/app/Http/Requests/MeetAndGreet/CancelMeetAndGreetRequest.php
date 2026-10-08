<?php

declare(strict_types=1);

namespace App\Http\Requests\MeetAndGreet;

use App\Enums\MeetAndGreetEndReason;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * The body of `POST /adoption-requests/{id}/meet-and-greet/cancel` (MG-10, FR11, FR26): the reason, one of the four
 * the dialog lists and always required, and optional details. The other side reads both.
 */
class CancelMeetAndGreetRequest extends FormRequest
{
    public const DETAILS_MAX = 600;

    /** The reasons for calling a meeting off before it happens; the rest of the enum says what happened after (MG-13). */
    public const REASONS = [
        MeetAndGreetEndReason::ScheduleConflict,
        MeetAndGreetEndReason::PetUnwell,
        MeetAndGreetEndReason::WeatherOrTravel,
        MeetAndGreetEndReason::Other,
    ];

    public function authorize(): bool
    {
        return true;
    }

    /** Empty details are no details. */
    protected function prepareForValidation(): void
    {
        $details = $this->input('details');
        if (is_string($details)) {
            $details = trim($details);
            $this->merge(['details' => $details === '' ? null : $details]);
        }
    }

    public function rules(): array
    {
        return [
            'reason' => ['required', 'string', Rule::in(array_map(fn (MeetAndGreetEndReason $reason) => $reason->value, self::REASONS))],
            'details' => ['sometimes', 'nullable', 'string', 'max:'.self::DETAILS_MAX],
        ];
    }

    public function messages(): array
    {
        return [
            'reason.*' => 'Choose a reason for cancelling the meeting.',
            'details.*' => 'Keep the details to '.self::DETAILS_MAX.' characters or fewer.',
        ];
    }

    public function reason(): MeetAndGreetEndReason
    {
        return MeetAndGreetEndReason::from($this->validated('reason'));
    }

    public function details(): ?string
    {
        return $this->validated('details');
    }
}
