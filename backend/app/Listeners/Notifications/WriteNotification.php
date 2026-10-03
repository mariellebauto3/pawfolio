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

        $categories = match ($event->type) {
            'request_received', 'request_approved', 'request_under_review',
            'request_declined', 'invite_sent' => 'requests_and_invites',
            'meet_greet_booked', 'meet_greet_cancelled' => 'meet_and_greets',
            'verification_approved', 'verification_denied' => 'post_activity',
            'account_action', 'announcement' => 'announcements',
            default => null,
        };

        // SEC-AUTHZ-08 / announcement gate: the user must explicitly opt in to
        // platform-wide messages (NT-08/09).
        if ($categories !== null && ! $preference->{$categories}()) {
            return;
        }

        // Guard: no raw PII in the title/body; the queue worker owns the
        // plaintext delivery. The stored row carries the safe payload only.
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
