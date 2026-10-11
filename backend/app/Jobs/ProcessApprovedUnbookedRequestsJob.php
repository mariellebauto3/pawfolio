<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Enums\ActivityLogType;
use App\Enums\AdoptionRequestStatus;
use App\Enums\NotificationType;
use App\Http\Controllers\Api\V1\AdoptionRequests\AdoptionRequestController;
use App\Models\AdoptionRequest;
use App\Models\Notification;
use App\Services\ActivityLogs\ActivityLogger;
use App\Services\Notifications\NotificationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;

/**
 * Sends a 7-day booking reminder and expires Approved requests after 14 days without a Meet & Greet booking (BE-19, MG-03).
 */
class ProcessApprovedUnbookedRequestsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function handle(NotificationService $notifications): array
    {
        $remindedCount = 0;
        $expiredCount = 0;
        $now = now();

        // 1. Expire Approved requests with no active booking after 14 days.
        $expiredIds = AdoptionRequest::query()
            ->where('status', AdoptionRequestStatus::Approved->value)
            ->whereDoesntHave('activeMeetAndGreet')
            ->where(function ($q) use ($now): void {
                $q->where(fn ($sub) => $sub->whereNotNull('expires_at')->where('expires_at', '<=', $now))
                    ->orWhere(fn ($sub) => $sub->whereNull('expires_at')->where('approved_at', '<=', $now->copy()->subDays(14)));
            })
            ->pluck('id');

        foreach ($expiredIds as $id) {
            DB::transaction(function () use ($id, $notifications, &$expiredCount): void {
                /** @var AdoptionRequest|null $ar */
                $ar = AdoptionRequest::query()
                    ->with(['pet.user', 'homeProfile.user', 'activeMeetAndGreet'])
                    ->whereKey($id)
                    ->lockForUpdate()
                    ->first();

                if (! $ar || $ar->getStatus() !== AdoptionRequestStatus::Approved || $ar->activeMeetAndGreet !== null) {
                    return;
                }

                $ar->status = AdoptionRequestStatus::Expired->value;
                $ar->closed_at = now();
                $ar->expires_at = null;
                $ar->save();

                if ($ar->pet) {
                    AdoptionRequestController::releasePetFromInProcess(
                        $ar->pet,
                        "Approved request #{$ar->id} expired after 14 days without a Meet & Greet booking",
                    );
                }

                $expiredCount++;

                ActivityLogger::log(
                    type: ActivityLogType::StatusChange,
                    action: 'approved_request_expired_no_booking',
                    actor: null,
                    subject: $ar,
                    before: AdoptionRequestStatus::Approved->value,
                    after: AdoptionRequestStatus::Expired->value,
                    reason: '14 days elapsed after approval without a Meet & Greet booking',
                );

                foreach (array_filter([$ar->pet?->user, $ar->homeProfile?->user]) as $recipient) {
                    $notifications->store(
                        recipient: $recipient,
                        type: NotificationType::RequestDeclined->value,
                        title: "Approved request for {$ar->pet?->name} expired",
                        body: 'No Meet & Greet was booked within 14 days of approval, so the request has expired.',
                        data: [
                            'category' => 'Requests',
                            'adoption_request_id' => $ar->id,
                            'link' => "/requests/{$ar->id}",
                        ],
                        urgency: 'info',
                        actionUrl: "/requests/{$ar->id}",
                    );
                }
            });
        }

        // 2. Send 7-day reminder to book a slot (idempotent via reminder_key).
        $reminderCandidates = AdoptionRequest::query()
            ->with(['pet.user', 'homeProfile'])
            ->where('status', AdoptionRequestStatus::Approved->value)
            ->whereDoesntHave('activeMeetAndGreet')
            ->where('approved_at', '<=', $now->copy()->subDays(7))
            ->get();

        foreach ($reminderCandidates as $ar) {
            if (! $ar->pet?->user) {
                continue;
            }

            $reminderKey = "approved_7d_booking_reminder:{$ar->id}";
            $alreadySent = Notification::query()
                ->where('user_id', $ar->pet->user_id)
                ->where('data->reminder_key', $reminderKey)
                ->exists();

            if ($alreadySent) {
                continue;
            }

            $notifications->store(
                recipient: $ar->pet->user,
                type: NotificationType::MeetGreetBooked->value,
                title: "Reminder: Book your Meet & Greet with {$ar->homeProfile?->full_name}",
                body: "7 days have passed since {$ar->homeProfile?->full_name} approved {$ar->pet->name}'s request. Book a slot within the next 7 days before the request expires.",
                data: [
                    'category' => 'Meet & Greets',
                    'adoption_request_id' => $ar->id,
                    'reminder_key' => $reminderKey,
                    'link' => "/requests/{$ar->id}",
                ],
                urgency: 'warning',
                actionUrl: "/requests/{$ar->id}",
            );

            $remindedCount++;
        }

        return [
            'reminded' => $remindedCount,
            'expired' => $expiredCount,
        ];
    }
}
