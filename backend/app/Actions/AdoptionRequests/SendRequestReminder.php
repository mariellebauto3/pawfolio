<?php

declare(strict_types=1);

namespace App\Actions\AdoptionRequests;

use App\Enums\ActivityLogType;
use App\Enums\AdoptionRequestStatus;
use App\Enums\NotificationType;
use App\Exceptions\ReminderRefused;
use App\Models\ActivityLog;
use App\Models\AdoptionRequest;
use App\Models\User;
use App\Services\ActivityLogs\ActivityLogger;
use App\Services\Notifications\NotificationService;
use Illuminate\Support\Carbon;

/**
 * An admin's reminder on a request that is waiting on someone (RQ-19, FR36). It goes to the side that has the next
 * step, in words that name the step, at most once a day per request, and it is logged with the admin's name
 * (SEC-LOG-01). Nothing about the request changes (FR27).
 */
class SendRequestReminder
{
    public const LOG_ACTION = 'admin_request_reminder_sent';

    /** Hours before another reminder may go out for the same request. */
    public const HOURS_BETWEEN = 24;

    public function __construct(
        private readonly NotificationService $notifications,
    ) {}

    /**
     * Which side has the next step, or null when nobody does: a request On Hold or ended, or a confirmed Meet &
     * Greet that is still ahead.
     *
     * @return 'pet'|'human'|null
     */
    public static function waitingOn(AdoptionRequest $ar): ?string
    {
        return match ($ar->getStatus()) {
            // The human answers the request, and decides once the two have met.
            AdoptionRequestStatus::Sent, AdoptionRequestStatus::AwaitingDecision => 'human',
            // The pet books a slot; once it has, the human confirms it.
            AdoptionRequestStatus::Approved => $ar->activeMeetAndGreet ? 'human' : 'pet',
            AdoptionRequestStatus::MeetScheduled => $ar->meetingHasPassed() ? 'human' : null,
            default => null,
        };
    }

    /** When the last reminder for this request went out, from the activity log. */
    public static function lastSentAt(AdoptionRequest $ar): ?Carbon
    {
        $last = ActivityLog::query()
            ->where('action', self::LOG_ACTION)
            ->where('subject_type', AdoptionRequest::class)
            ->where('subject_id', $ar->id)
            ->max('created_at');

        return $last ? Carbon::parse($last) : null;
    }

    public static function sentRecently(AdoptionRequest $ar): bool
    {
        return self::lastSentAt($ar)?->gt(now()->subHours(self::HOURS_BETWEEN)) ?? false;
    }

    /**
     * @return 'pet'|'human' the side that was reminded
     *
     * @throws ReminderRefused when nobody has a step to take, or a reminder went out in the last 24 hours
     */
    public function handle(AdoptionRequest $ar, User $admin, ?string $userAgent = null): string
    {
        $ar->loadMissing(['pet.user', 'homeProfile.user', 'activeMeetAndGreet.slot', 'latestMeetAndGreet.slot']);

        $side = self::waitingOn($ar);
        $recipient = $side === 'pet' ? $ar->pet?->user : ($side === 'human' ? $ar->homeProfile?->user : null);
        if ($side === null || $recipient === null) {
            throw ReminderRefused::nobodyToRemind();
        }
        if (self::sentRecently($ar)) {
            throw ReminderRefused::alreadySent();
        }

        $pet = $ar->pet?->name ?? 'the pet';
        $home = $ar->homeProfile?->full_name ?? 'the home';

        [$title, $body] = match (true) {
            $side === 'pet' => ["Reminder: book your Meet & Greet with {$home}", "{$home} approved your request. Pick one of their slots so you can meet."],
            $ar->getStatus() === AdoptionRequestStatus::Sent => ["Reminder: {$pet} is waiting for your answer", "{$pet} sent you an adoption request. Approve or decline it before it expires."],
            $ar->getStatus() === AdoptionRequestStatus::Approved => ["Reminder: confirm the Meet & Greet with {$pet}", "{$pet} booked one of your slots. Confirm it or propose another time."],
            default => ["Reminder: decide on the request from {$pet}", "Your Meet & Greet with {$pet} has passed. Choose Adopt, Decline or It didn't happen."],
        };

        $this->notifications->store(
            recipient: $recipient,
            type: NotificationType::RequestUnderReview->value,
            title: $title,
            body: $body,
            data: [
                'category' => 'Requests',
                'adoption_request_id' => $ar->id,
                'link' => "/requests/{$ar->id}",
            ],
            urgency: 'warning',
            actionUrl: "/requests/{$ar->id}",
        );

        ActivityLogger::log(
            type: ActivityLogType::Request,
            action: self::LOG_ACTION,
            actor: $admin,
            subject: $ar,
            after: $side,
            userAgent: $userAgent,
        );

        return $side;
    }
}
