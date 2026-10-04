<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Enums\ActivityLogType;
use App\Enums\AdoptionRequestStatus;
use App\Enums\NotificationType;
use App\Models\AdoptionRequest;
use App\Services\ActivityLogs\ActivityLogger;
use App\Services\Notifications\NotificationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;

/**
 * Expires Sent adoption requests after 14 days without an answer (BE-19, RQ-04, RQ-11).
 */
class ExpireSentRequestsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function handle(NotificationService $notifications): int
    {
        $expiredCount = 0;

        $dueIds = AdoptionRequest::query()
            ->where('status', AdoptionRequestStatus::Sent->value)
            ->whereNotNull('expires_at')
            ->where('expires_at', '<=', now())
            ->pluck('id');

        foreach ($dueIds as $id) {
            DB::transaction(function () use ($id, $notifications, &$expiredCount): void {
                /** @var AdoptionRequest|null $ar */
                $ar = AdoptionRequest::query()
                    ->with(['pet.user', 'homeProfile'])
                    ->whereKey($id)
                    ->lockForUpdate()
                    ->first();

                if (! $ar || $ar->getStatus() !== AdoptionRequestStatus::Sent || ! $ar->expires_at || $ar->expires_at->isFuture()) {
                    return;
                }

                $ar->status = AdoptionRequestStatus::Expired->value;
                $ar->closed_at = now();
                $ar->expires_at = null;
                $ar->save();

                $expiredCount++;

                ActivityLogger::log(
                    type: ActivityLogType::StatusChange,
                    action: 'adoption_request_expired',
                    actor: null,
                    subject: $ar,
                    before: AdoptionRequestStatus::Sent->value,
                    after: AdoptionRequestStatus::Expired->value,
                    reason: '14-day review window elapsed without response',
                );

                if ($ar->pet?->user) {
                    $prefs = $ar->pet->user->notificationPreference;
                    if (! $prefs || $prefs->shouldRequestAndInvite()) {
                        $notifications->store(
                            recipient: $ar->pet->user,
                            type: NotificationType::RequestDeclined->value,
                            title: "Request to {$ar->homeProfile?->full_name} expired",
                            body: '14 days passed without a response, so this request has expired and your open request slot is free again.',
                            data: [
                                'category' => 'Requests',
                                'adoption_request_id' => $ar->id,
                                'link' => "/requests/{$ar->id}",
                            ],
                            urgency: 'info',
                            actionUrl: "/requests/{$ar->id}",
                        );
                    }
                }
            });
        }

        return $expiredCount;
    }
}
