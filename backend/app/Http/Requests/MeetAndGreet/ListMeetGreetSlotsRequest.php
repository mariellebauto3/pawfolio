<?php

declare(strict_types=1);

namespace App\Http\Requests\MeetAndGreet;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * What may be asked of `GET /meet-greet-slots` (MG-01, MG-03, docs/api/adoption-and-meet-greet.md): a human's own
 * slots still ahead or the Meet & Greets already behind them, a page at a time; or, for a pet, the open slots of a
 * home that approved it. Whose slots they are is the controller's to check on the records.
 */
class ListMeetGreetSlotsRequest extends FormRequest
{
    public const DEFAULT_PER_PAGE = 20;

    public const MAX_PER_PAGE = 50;

    public const UPCOMING = 'upcoming';

    public const PAST = 'past';

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'when' => ['sometimes', 'nullable', 'string', Rule::in([self::UPCOMING, self::PAST])],
            'home_profile_id' => ['sometimes', 'nullable', 'integer', 'min:1'],
            'page' => ['sometimes', 'nullable', 'integer', 'min:1'],
        ];
    }

    public function messages(): array
    {
        return [
            'when.in' => 'Choose upcoming or past.',
            'home_profile_id.*' => 'Choose a home.',
            'page.*' => 'Choose a page number of 1 or more.',
        ];
    }

    public function isPast(): bool
    {
        return $this->validated('when') === self::PAST;
    }

    public function homeProfileId(): ?int
    {
        $id = $this->validated('home_profile_id');

        return $id === null ? null : (int) $id;
    }

    /** As every list: 20 a page unless asked, never more than 50 (SEC-API-05). */
    public function perPage(): int
    {
        return min(max((int) $this->query('per_page', (string) self::DEFAULT_PER_PAGE), 1), self::MAX_PER_PAGE);
    }
}
