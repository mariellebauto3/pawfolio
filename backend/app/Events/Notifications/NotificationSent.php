<?php

declare(strict_types=1);

namespace App\Events\Notifications;

use App\Models\User;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class NotificationSent
{
    use Dispatchable;
    use InteractsWithSockets;
    use SerializesModels;

    public function __construct(
        public readonly User $recipient,
        public readonly string $type,
        public readonly string $title,
        public readonly string $body,
        public readonly array $data,
        public readonly string $urgency,
        public readonly ?string $actionUrl,
    ) {}
}
