<?php

declare(strict_types=1);

namespace App\Http\Resources\Notifications;

use App\Models\Notification;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Notification */
class NotificationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'type' => $this->type,
            'category' => $this->category,
            'title' => $this->title,
            'body' => $this->body,
            'data' => isset($this->data) ? $this->data : null,
            'is_read' => $this->is_read,
            'is_dismissed' => $this->is_dismissed,
            'urgency' => $this->urgency,
            'action_url' => $this->action_url,
            'sender' => $this->sender,
            'created_at' => $this->created_at->toIso8601String(),
        ];
    }
}
