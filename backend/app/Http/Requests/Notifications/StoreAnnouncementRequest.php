<?php

declare(strict_types=1);

namespace App\Http\Requests\Notifications;

use App\Enums\AnnouncementAudience;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

/**
 * The body of `POST /admin/announcements` (NT-04, NT-05, FR39): a title, a message, who it is for, and when. With no
 * `publish_at` it goes out now; with one it is scheduled, and that time has to be still ahead, because an
 * announcement can't be taken back once it is published. Who is publishing is the session's, and the route checks
 * the admin role (SEC-AUTHZ-07).
 */
class StoreAnnouncementRequest extends FormRequest
{
    public const TITLE_MAX = 160;

    public const MESSAGE_MAX = 2000;

    /** How far ahead an announcement can be scheduled: a typed year that is off by one shouldn't wait unseen. */
    public const SCHEDULE_AHEAD_DAYS = 365;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:'.self::TITLE_MAX],
            'message' => ['required', 'string', 'max:'.self::MESSAGE_MAX],
            'audience' => ['required', 'string', Rule::enum(AnnouncementAudience::class)],
            'publish_at' => ['sometimes', 'nullable', 'date', 'after:now', 'before:'.now()->addDays(self::SCHEDULE_AHEAD_DAYS)->toISOString()],
        ];
    }

    public function messages(): array
    {
        return [
            'title.required' => 'Enter a title.',
            'title.*' => 'Keep the title to '.self::TITLE_MAX.' characters or fewer.',
            'message.required' => 'Enter a message.',
            'message.*' => 'Keep the message to '.self::MESSAGE_MAX.' characters or fewer.',
            'audience.*' => 'Choose who the announcement is for.',
            'publish_at.after' => 'Choose a time that is still ahead, or publish now.',
            'publish_at.before' => 'Choose a time within the next year.',
            'publish_at.*' => 'Enter a valid date and time.',
        ];
    }

    public function audience(): AnnouncementAudience
    {
        return AnnouncementAudience::from($this->validated('audience'));
    }

    /** When it is scheduled for; null to publish now. */
    public function publishAt(): ?Carbon
    {
        $at = $this->validated('publish_at');

        return $at !== null ? Carbon::parse($at) : null;
    }
}
