<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Enums\AccountStatus;
use App\Enums\ActivityLogType;
use App\Enums\AnnouncementAudience;
use App\Enums\NotificationType;
use App\Enums\Role;
use App\Models\Announcement;
use App\Models\User;
use App\Services\ActivityLogs\ActivityLogger;
use App\Services\Notifications\NotificationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;

/**
 * Publishes due scheduled announcements and delivers notifications to the target audience (BE-19, BE-24, NT-04..NT-05).
 */
class PublishScheduledAnnouncementsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function handle(NotificationService $notifications): int
    {
        $publishedCount = 0;

        $dueIds = Announcement::query()->due()->pluck('id');

        foreach ($dueIds as $id) {
            DB::transaction(function () use ($id, $notifications, &$publishedCount): void {
                /** @var Announcement|null $announcement */
                $announcement = Announcement::query()->whereKey($id)->lockForUpdate()->first();
                if (! $announcement || $announcement->isPublished()) {
                    return;
                }

                $announcement->published_at = now();
                $announcement->save();
                $publishedCount++;

                self::deliverAnnouncementNotifications($announcement, $notifications);

                ActivityLogger::log(
                    type: ActivityLogType::Announcement,
                    action: 'announcement_published',
                    actor: null,
                    subject: $announcement,
                    after: $announcement->audience()->value,
                    reason: $announcement->title,
                );
            });
        }

        return $publishedCount;
    }

    public static function deliverAnnouncementNotifications(Announcement $announcement, NotificationService $notifications): int
    {
        $audience = $announcement->audience();
        $roles = match ($audience) {
            AnnouncementAudience::Pets => [Role::Pet->value],
            AnnouncementAudience::Humans => [Role::Human->value],
            AnnouncementAudience::Everyone => [Role::Pet->value, Role::Human->value],
        };

        $recipients = User::query()
            ->with('notificationPreference')
            ->whereIn('role', $roles)
            ->where('status', AccountStatus::Active->value)
            ->get();

        $delivered = 0;
        foreach ($recipients as $recipient) {
            $prefs = $recipient->notificationPreference;
            if ($prefs && ! $prefs->shouldAnnouncements()) {
                continue;
            }

            $notifications->store(
                recipient: $recipient,
                type: NotificationType::Announcement->value,
                title: $announcement->title,
                body: $announcement->message,
                data: [
                    'category' => 'Account',
                    'announcement_id' => $announcement->id,
                    'audience' => $audience->value,
                    'link' => '/feed',
                ],
                urgency: 'info',
                actionUrl: '/feed',
            );

            $delivered++;
        }

        return $delivered;
    }
}
