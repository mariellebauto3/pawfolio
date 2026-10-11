<?php

declare(strict_types=1);

namespace App\Http\Requests\Notifications;

use App\Enums\NotificationType;
use App\Enums\NotificationUrgency;
use App\Http\Requests\ApiRequest;
use Illuminate\Validation\Rule;

class SendNotificationRequest extends ApiRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'to' => ['required', 'int', 'exists:users,id'],
            'type' => [
                'required',
                'string',
                Rule::in(array_column(NotificationType::cases(), 'value')),
            ],
            'title' => 'required|string|max:255',
            'body' => 'required|string|max:4096',
            'data' => 'array',
            'data.subject_type' => 'sometimes|string|max:255',
            'data.subject_id' => 'sometimes|int',
            'data.action' => 'sometimes|string|max:255',
            'urgency' => [
                'sometimes',
                'string',
                Rule::in(array_column(NotificationUrgency::cases(), 'value')),
            ],
            'action_url' => 'sometimes|url|max:255',
        ];
    }

    public function messages(): array
    {
        return [
            'to.required' => 'The recipient is required.',
            'to.exists' => 'The recipient account does not exist.',
            'type.required' => 'The notification type is required.',
            'title.required' => 'The title is required.',
            'body.required' => 'The body is required.',
            'urgency.in' => 'The selected urgency is not allowed.',
        ];
    }
}
