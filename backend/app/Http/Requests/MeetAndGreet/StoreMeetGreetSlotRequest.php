<?php

declare(strict_types=1);

namespace App\Http\Requests\MeetAndGreet;

use App\Enums\MeetGreetPlaceType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

/**
 * The body of `POST /meet-greet-slots` (MG-02, FR11): when, where, and whether the slot repeats weekly. A place at
 * the caretaker's is the pet's side to name, so only the other two kinds need their details. Whose slot it becomes
 * comes from the session (SEC-AUTHZ-02).
 */
class StoreMeetGreetSlotRequest extends FormRequest
{
    public const PLACE_DETAILS_MAX = 255;

    public const MAX_WEEKS = 4;

    public function authorize(): bool
    {
        return true;
    }

    /** Details are trimmed before they are counted; empty is none. */
    protected function prepareForValidation(): void
    {
        $details = $this->input('place_details');
        if (is_string($details)) {
            $details = trim($details);
            $this->merge(['place_details' => $details === '' ? null : $details]);
        }
    }

    public function rules(): array
    {
        return [
            'starts_at' => ['required', 'date', 'after:now', 'before:+1 year'],
            'place_type' => ['required', 'string', Rule::enum(MeetGreetPlaceType::class)],
            'place_details' => [
                'required_unless:place_type,'.MeetGreetPlaceType::CaretakerLocation->value,
                'nullable',
                'string',
                'max:'.self::PLACE_DETAILS_MAX,
            ],
            'repeat' => ['sometimes', 'nullable', 'string', Rule::in(['none', 'weekly_2', 'weekly_3', 'weekly_4'])],
            'repeat_weeks' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:'.self::MAX_WEEKS],
        ];
    }

    public function messages(): array
    {
        return [
            'starts_at.required' => 'Choose a date and a time.',
            'starts_at.date' => 'Choose a date and a time.',
            'starts_at.after' => 'Choose a time that is still ahead.',
            'starts_at.before' => 'Choose a date within the next 12 months.',
            'place_type.*' => 'Choose where the meeting takes place.',
            'place_details.required_unless' => 'Say where to meet, such as the name of the park or the shelter.',
            'place_details.*' => 'Keep the place details to '.self::PLACE_DETAILS_MAX.' characters or fewer.',
            'repeat.*' => 'Choose how the slot repeats from the list.',
            'repeat_weeks.*' => 'A slot repeats for '.self::MAX_WEEKS.' weeks at most.',
        ];
    }

    public function startsAt(): Carbon
    {
        return Carbon::parse($this->validated('starts_at'))->utc();
    }

    public function placeType(): string
    {
        return $this->validated('place_type');
    }

    public function placeDetails(): ?string
    {
        return $this->validated('place_details');
    }

    /** How many weeks in a row the slot is added for, this one included. */
    public function weeks(): int
    {
        $weeks = $this->validated('repeat_weeks');
        if ($weeks !== null) {
            return (int) $weeks;
        }

        return match ($this->validated('repeat')) {
            'weekly_2' => 2,
            'weekly_3' => 3,
            'weekly_4' => 4,
            default => 1,
        };
    }
}
