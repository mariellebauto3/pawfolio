<?php

declare(strict_types=1);

namespace App\Services\Notifications;

use App\Models\Notification;
use App\Models\User;
use Illuminate\Support\Facades\Log;

class NotificationService
{
    public function store(
        User $recipient,
        string $type,
        string $title,
        string $body,
        array $data = [],
        string $urgency = 'info',
        ?string $actionUrl = null,
    ): Notification {
        $notification = $recipient->notifications()->create([
            'type' => $type,
            'title' => $title,
            'body' => $body,
            'data' => $data,
            'urgency' => $urgency,
            'action_url' => $actionUrl,
        ]);

        Log::debug('notification.stored', [
            'notification_id' => $notification->id,
            'recipient_id' => $recipient->id,
            'type' => $type,
            'urgency' => $urgency,
            'action_url' => $actionUrl,
        ]);

        return $notification;
    }
}
