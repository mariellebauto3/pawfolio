<?php

declare(strict_types=1);

namespace App\Listeners\Notifications;

use App\Events\Notifications\NotificationSent;
use App\Models\NotificationPreference;
use App\Services\Notifications\NotificationService;
use Illuminate\Contracts\Queue\ShouldQueue;

class WriteNotification implements ShouldQueue
{
    public function __construct(
        private readonly NotificationService $notificationService,
    ) {}

    public function handle(NotificationSent $event): void
    {
        $preference = $event->recipient->notificationPreference
            ?? new NotificationPreference;

        // Account and security notices (verification_approved, verification_denied,
        // account_suspended, account_reactivated, report_outcome) always send (BE-10).
        $categoryToggle = match ($event->type) {
            'request_received', 'request_approved', 'request_under_review',
            'request_declined', 'request_withdrawn', 'request_expired',
            'request_on_hold', 'invite_sent', 'invite_received',
            'adoption_complete', 'not_adopted' => 'requests_and_invites',
            'meet_greet_booked', 'meet_greet_confirmed', 'meet_greet_rescheduled',
            'meet_greet_cancelled', 'meet_greet_reminder', 'decision_needed' => 'meet_and_greets',
            'post_reaction', 'post_comment', 'comment_reply' => 'post_activity',
            'announcement' => 'announcements',
            default => null,
        };

        if ($categoryToggle !== null && ! $preference->{$categoryToggle}()) {
            return;
        }

        $this->notificationService->store(
            $event->recipient,
            $event->type,
            $event->title,
            $event->body,
            $event->data,
            $event->urgency,
            $event->actionUrl,
        );
    }
}
