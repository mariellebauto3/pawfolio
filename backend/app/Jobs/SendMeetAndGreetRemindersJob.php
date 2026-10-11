<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Enums\MeetAndGreetStatus;
use App\Enums\NotificationType;
use App\Models\MeetAndGreet;
use App\Models\Notification;
use App\Services\Notifications\NotificationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * Sends 1-day (24h) and 1-hour (1h) reminders before a confirmed Meet & Greet (BE-19, MG-07).
 */
class SendMeetAndGreetRemindersJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function handle(NotificationService $notifications): int
    {
        $sentCount = 0;
        $now = now();

        $confirmedMeetings = MeetAndGreet::query()
            ->with(['slot', 'request.pet.user', 'request.homeProfile.user'])
            ->where('status', MeetAndGreetStatus::Confirmed->value)
            ->whereHas('slot', fn ($q) => $q->where('starts_at', '>', $now)->where('starts_at', '<=', $now->copy()->addHours(25)))
            ->get();

        foreach ($confirmedMeetings as $mg) {
            if (! $mg->slot || ! $mg->request) {
                continue;
            }

            $minutesUntil = $now->diffInMinutes($mg->slot->starts_at, false);
            $window = null;
            if ($minutesUntil <= 65 && $minutesUntil > 0) {
                $window = '1h';
            } elseif ($minutesUntil <= 24 * 60 + 30 && $minutesUntil > 65) {
                $window = '24h';
            }

            if ($window === null) {
                continue;
            }

            $ar = $mg->request;
            $recipients = array_filter([$ar->pet?->user, $ar->homeProfile?->user]);

            foreach ($recipients as $recipient) {
                $prefs = $recipient->notificationPreference;
                if ($prefs && ! $prefs->shouldMeetAndGreet()) {
                    continue;
                }

                $reminderKey = "meet_greet_{$window}:{$mg->id}:{$recipient->id}";
                $alreadySent = Notification::query()
                    ->where('user_id', $recipient->id)
                    ->where('data->reminder_key', $reminderKey)
                    ->exists();

                if ($alreadySent) {
                    continue;
                }

                $whenLabel = $window === '1h' ? 'in 1 hour' : 'tomorrow';
                $notifications->store(
                    recipient: $recipient,
                    type: NotificationType::MeetGreetBooked->value,
                    title: "Meet & Greet reminder ({$whenLabel})",
                    body: "Your Meet & Greet for {$ar->pet?->name} is scheduled for {$mg->slot->starts_at->format('M j, Y g:i A')} at {$mg->slot->place_details}.",
                    data: [
                        'category' => 'Meet & Greets',
                        'adoption_request_id' => $ar->id,
                        'meet_and_greet_id' => $mg->id,
                        'reminder_key' => $reminderKey,
                        'link' => "/requests/{$ar->id}",
                    ],
                    urgency: $window === '1h' ? 'urgent' : 'info',
                    actionUrl: "/requests/{$ar->id}",
                );

                $sentCount++;
            }
        }

        return $sentCount;
    }
}
