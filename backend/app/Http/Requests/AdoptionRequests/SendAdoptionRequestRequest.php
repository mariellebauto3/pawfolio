<?php

declare(strict_types=1);

namespace App\Http\Requests\AdoptionRequests;

use App\Models\AdoptionRequest;
use Illuminate\Foundation\Http\FormRequest;

/**
 * The body of sending an adoption request (RQ-03, FR24): the cover letter and the caretaker's notes. The pet is the
 * sender's own, and the status and dates are set by the system, so none of them can come from the body
 * (SEC-INPUT-04). The home comes from the path, or from `home_profile_id` on the alias `POST /adoption-requests`.
 */
class SendAdoptionRequestRequest extends FormRequest
{
    /** "Why I'd fit your home", as the screen says it (RQ-03, SEC-INPUT-05). */
    public const COVER_LETTER_MIN = 50;

    public const COVER_LETTER_MAX = 600;

    public const CARETAKER_NOTES_MAX = 600;

    /** Only a pet applies (AdoptionRequestPolicy); the route's middleware has checked signed-in and Active. */
    public function authorize(): bool
    {
        return $this->user()?->can('create', AdoptionRequest::class) ?? false;
    }

    /** Trimmed before the lengths are counted (SEC-INPUT-06); empty notes are no notes. */
    protected function prepareForValidation(): void
    {
        $trimmed = [];
        foreach (['cover_letter', 'caretaker_notes'] as $field) {
            $value = $this->input($field);
            if (is_string($value)) {
                $trimmed[$field] = trim($value);
            }
        }
        if (($trimmed['caretaker_notes'] ?? null) === '') {
            $trimmed['caretaker_notes'] = null;
        }
        // The home in the path wins over one in the body.
        if ($this->route('home') !== null) {
            $trimmed['home_profile_id'] = $this->route('home');
        }
        $this->merge($trimmed);
    }

    public function rules(): array
    {
        return [
            'home_profile_id' => ['required', 'integer', 'min:1'],
            'cover_letter' => ['required', 'string', 'min:'.self::COVER_LETTER_MIN, 'max:'.self::COVER_LETTER_MAX],
            'caretaker_notes' => ['nullable', 'string', 'max:'.self::CARETAKER_NOTES_MAX],
        ];
    }

    public function messages(): array
    {
        $letter = 'Write between '.self::COVER_LETTER_MIN.' and '.self::COVER_LETTER_MAX.' characters.';
        $notes = 'Keep the notes to '.self::CARETAKER_NOTES_MAX.' characters or fewer.';
        $home = 'Choose a home to apply to.';

        return [
            'home_profile_id.required' => $home,
            'home_profile_id.integer' => $home,
            'home_profile_id.min' => $home,
            'cover_letter.required' => $letter,
            'cover_letter.string' => $letter,
            'cover_letter.min' => $letter,
            'cover_letter.max' => $letter,
            'caretaker_notes.string' => $notes,
            'caretaker_notes.max' => $notes,
        ];
    }

    public function homeProfileId(): int
    {
        return (int) $this->validated('home_profile_id');
    }

    public function coverLetter(): string
    {
        return $this->validated('cover_letter');
    }

    public function caretakerNotes(): ?string
    {
        return $this->validated('caretaker_notes');
    }
}
