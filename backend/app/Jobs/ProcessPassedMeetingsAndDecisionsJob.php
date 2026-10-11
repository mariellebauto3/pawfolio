<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Enums\ActivityLogType;
use App\Enums\AdoptionRequestStatus;
use App\Enums\MeetAndGreetStatus;
use App\Enums\NotificationType;
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
 * Transitions MeetScheduled requests whose meeting time has passed to AwaitingDecision,
 * sends daily decision reminders for 7 days, and then flags them as overdue for Admin review (BE-19, MG-11, MG-16).
 */
class ProcessPassedMeetingsAndDecisionsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function handle(NotificationService $notifications): array
    {
        $transitioned = 0;
        $reminded = 0;
        $flaggedOverdue = 0;
        $now = now();

        // 1. Transition MeetScheduled -> AwaitingDecision once slot.starts_at <= now().
        $scheduledRequests = AdoptionRequest::query()
            ->with(['pet', 'homeProfile.user', 'activeMeetAndGreet.slot', 'latestMeetAndGreet.slot'])
            ->where('status', AdoptionRequestStatus::MeetScheduled->value)
            ->get();

        foreach ($scheduledRequests as $ar) {
            $mg = $ar->activeMeetAndGreet ?? $ar->latestMeetAndGreet;
            if (! $mg || ! $mg->slot || ! $mg->slot->starts_at || $mg->slot->starts_at->isFuture()) {
                continue;
            }

            DB::transaction(function () use ($ar, $mg, $notifications, $now, &$transitioned): void {
                if ($mg->getStatus() !== MeetAndGreetStatus::Ended) {
                    $mg->status = MeetAndGreetStatus::Ended->value;
                    $mg->ended_at = $now;
                    $mg->save();
                }

                $ar->status = AdoptionRequestStatus::AwaitingDecision->value;
                $ar->awaiting_decision_at = $now;
                $ar->save();

                $transitioned++;

                ActivityLogger::log(
                    type: ActivityLogType::StatusChange,
                    action: 'adoption_request_awaiting_decision',
                    actor: null,
                    subject: $ar,
                    before: AdoptionRequestStatus::MeetScheduled->value,
                    after: AdoptionRequestStatus::AwaitingDecision->value,
                    reason: 'Scheduled Meet & Greet time passed',
                );

                if ($ar->homeProfile?->user) {
                    $notifications->store(
                        recipient: $ar->homeProfile->user,
                        type: NotificationType::RequestUnderReview->value,
                        title: "How did the Meet & Greet with {$ar->pet?->name} go?",
                        body: "Please record your decision (Adopt, Decline, or It didn't happen) on request #{$ar->id}.",
                        data: [
                            'category' => 'Meet & Greets',
                            'adoption_request_id' => $ar->id,
                            'link' => "/requests/{$ar->id}",
                        ],
                        urgency: 'warning',
                        actionUrl: "/requests/{$ar->id}",
                    );
                }
            });
        }

        // 2. Daily reminders for 7 days in AwaitingDecision, then flag overdue at day 7+.
        $awaitingRequests = AdoptionRequest::query()
            ->with(['pet', 'homeProfile.user'])
            ->where('status', AdoptionRequestStatus::AwaitingDecision->value)
            ->whereNotNull('awaiting_decision_at')
            ->get();

        foreach ($awaitingRequests as $ar) {
            $daysElapsed = (int) $ar->awaiting_decision_at->diffInDays($now);

            if ($daysElapsed >= 7) {
                if ($ar->overdue_flagged_at === null) {
                    $ar->overdue_flagged_at = $now;
                    $ar->save();
                    $flaggedOverdue++;

                    ActivityLogger::log(
                        type: ActivityLogType::System,
                        action: 'adoption_request_flagged_overdue',
                        actor: null,
                        subject: $ar,
                        reason: '7 days in Awaiting Decision without a decision',
                    );
                }

                continue;
            }

            if ($daysElapsed >= 1 && $ar->homeProfile?->user) {
                $dateKey = $now->format('Y-m-d');
                $reminderKey = "decision_daily_reminder:{$ar->id}:{$dateKey}";

                $alreadySentToday = Notification::query()
                    ->where('user_id', $ar->homeProfile->user_id)
                    ->where('data->reminder_key', $reminderKey)
                    ->exists();

                if (! $alreadySentToday) {
                    $notifications->store(
                        recipient: $ar->homeProfile->user,
                        type: NotificationType::RequestUnderReview->value,
                        title: "Decision needed for {$ar->pet?->name}",
                        body: "Your Meet & Greet with {$ar->pet?->name} has passed. Please confirm your decision so {$ar->pet?->name} isn't left waiting.",
                        data: [
                            'category' => 'Meet & Greets',
                            'adoption_request_id' => $ar->id,
                            'reminder_key' => $reminderKey,
                            'link' => "/requests/{$ar->id}",
                        ],
                        urgency: 'warning',
                        actionUrl: "/requests/{$ar->id}",
                    );
                    $reminded++;
                }
            }
        }

        return [
            'transitioned' => $transitioned,
            'reminded' => $reminded,
            'flagged_overdue' => $flaggedOverdue,
        ];
    }
}
