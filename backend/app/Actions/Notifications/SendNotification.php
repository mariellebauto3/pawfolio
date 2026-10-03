<?php

declare(strict_types=1);

namespace App\Actions\Notifications;

use App\Events\Notifications\NotificationSent;
use App\Models\User;
use App\Services\Notifications\NotificationService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Support\Facades\Log;

class SendNotification implements ShouldQueue
{
    public function __construct(
        private readonly NotificationService $notificationService,
    ) {}

    public function execute(User $recipient, string $type, string $title, string $body, array $data = [], string $urgency = 'info', ?string $actionUrl = null): void
    {
        if (! $recipient->isActive()) {
            Log::warning('notification.dropped_inactive_recipient', [
                'recipient_id' => $recipient->id,
                'type' => $type,
            ]);

            return;
        }

        $event = new NotificationSent(
            recipient: $recipient,
            type: $type,
            title: $title,
            body: $body,
            data: $data,
            urgency: $urgency,
            actionUrl: $actionUrl,
        );

        NotificationSent::dispatch($event);
    }
}
