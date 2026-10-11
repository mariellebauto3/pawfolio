<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Notifications;

use App\Enums\AccountStatus;
use App\Enums\ActivityLogType;
use App\Enums\AnnouncementAudience;
use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Http\Requests\Notifications\StoreAnnouncementRequest;
use App\Http\Resources\PaginatedResource;
use App\Http\Resources\ResponseResource;
use App\Jobs\PublishScheduledAnnouncementsJob;
use App\Models\Announcement;
use App\Models\User;
use App\Services\ActivityLogs\ActivityLogger;
use App\Services\Notifications\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * The admin's announcements (BE-24, FE-24, NT-04, NT-05, FR39, docs/api/community-reports-and-admin.md): the list
 * of what was published and what is scheduled, and publishing one, now or at a time that is still ahead. A published
 * announcement reaches its audience's Alerts and the feed; it is never edited or deleted afterwards (the table is
 * append-only), and every one is logged with the admin's name (SEC-LOG-01).
 */
class AnnouncementController extends Controller
{
    public function __construct(
        private readonly NotificationService $notifications,
    ) {}

    public function index(Request $request)
    {
        $filters = $request->validate([
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:50'],
        ]);

        $paginator = Announcement::query()
            ->with('admin')
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate((int) ($filters['per_page'] ?? 20));

        $page = PaginatedResource::fromPaginator($paginator, fn (Announcement $a) => $this->formatAnnouncement($a));

        // How many Active accounts each audience is right now, for "Everyone (312 active accounts)" on NT-05.
        return new ResponseResource($page->data, [...$page->meta, 'audience_counts' => $this->audienceCounts()], $page->links);
    }

    /**
     * What a member reads on the Announcements tab of Notifications (NT-02, NT-03): the announcements published for
     * their role, newest first. It doesn't depend on an alert having been delivered, so an account approved after
     * an announcement went out, or one that turned announcement alerts off, still reads it. The admin's name and
     * anything scheduled stay out (SEC-API-01).
     */
    public function published(Request $request)
    {
        $filters = $request->validate([
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:50'],
        ]);

        $paginator = Announcement::query()
            ->visibleTo($request->user())
            ->orderByDesc('published_at')
            ->orderByDesc('id')
            ->paginate((int) ($filters['per_page'] ?? 20));

        return PaginatedResource::fromPaginator($paginator, fn (Announcement $a) => [
            'id' => $a->id,
            'title' => $a->title,
            'message' => $a->message,
            'published_at' => $a->published_at?->toISOString(),
        ]);
    }

    public function store(StoreAnnouncementRequest $request)
    {
        $admin = $request->user();
        $publishAt = $request->publishAt();
        $publishNow = $publishAt === null;

        [$announcement, $deliveredCount] = DB::transaction(function () use ($admin, $request, $publishAt, $publishNow): array {
            $announcement = new Announcement;
            $announcement->admin_user_id = $admin->id;
            $announcement->title = trim($request->validated('title'));
            $announcement->message = trim($request->validated('message'));
            $announcement->audience = $request->audience()->value;
            $announcement->publish_at = $publishAt ?? now();
            $announcement->published_at = $publishNow ? now() : null;
            $announcement->save();

            $deliveredCount = $publishNow
                ? PublishScheduledAnnouncementsJob::deliverAnnouncementNotifications($announcement, $this->notifications)
                : 0;

            ActivityLogger::log(
                type: ActivityLogType::Announcement,
                action: $publishNow ? 'announcement_published' : 'announcement_scheduled',
                actor: $admin,
                subject: $announcement,
                after: $announcement->audience()->value,
                reason: $announcement->title,
                userAgent: $request->userAgent(),
            );

            return [$announcement, $deliveredCount];
        });

        $announcement->load('admin');

        return ResponseResource::created([
            ...$this->formatAnnouncement($announcement),
            'recipients_notified' => $deliveredCount,
        ]);
    }

    /**
     * Active Pet and Human accounts by audience. An account that turned announcements off in its settings is still
     * counted: it gets no alert, but reads the announcement on the feed.
     *
     * @return array<string, int>
     */
    private function audienceCounts(): array
    {
        $byRole = User::query()
            ->toBase()
            ->whereIn('role', [Role::Pet->value, Role::Human->value])
            ->where('status', AccountStatus::Active->value)
            ->selectRaw('role, count(*) as total')
            ->groupBy('role')
            ->pluck('total', 'role');

        $pets = (int) ($byRole[Role::Pet->value] ?? 0);
        $humans = (int) ($byRole[Role::Human->value] ?? 0);

        return [
            AnnouncementAudience::Everyone->value => $pets + $humans,
            AnnouncementAudience::Pets->value => $pets,
            AnnouncementAudience::Humans->value => $humans,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function formatAnnouncement(Announcement $a): array
    {
        return [
            'id' => $a->id,
            'title' => $a->title,
            'message' => $a->message,
            'audience' => $a->audience()->value,
            'status' => $a->isPublished() ? 'published' : 'scheduled',
            'publish_at' => $a->publish_at?->toISOString(),
            'published_at' => $a->published_at?->toISOString(),
            'admin_name' => $a->admin?->displayName(),
            'created_at' => $a->created_at?->toISOString(),
        ];
    }
}
