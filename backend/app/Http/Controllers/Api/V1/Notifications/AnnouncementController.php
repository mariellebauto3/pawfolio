<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Notifications;

use App\Enums\ActivityLogType;
use App\Enums\AnnouncementAudience;
use App\Http\Controllers\Controller;
use App\Http\Resources\PaginatedResource;
use App\Http\Resources\ResponseResource;
use App\Jobs\PublishScheduledAnnouncementsJob;
use App\Models\Announcement;
use App\Services\ActivityLogs\ActivityLogger;
use App\Services\Notifications\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Admin platform-wide announcements creation, scheduling, and history (BE-24, NT-04, NT-05, FR39).
 */
class AnnouncementController extends Controller
{
    public function __construct(
        private readonly NotificationService $notifications,
    ) {}

    public function index(Request $request)
    {
        $perPage = min(max((int) $request->query('per_page', 20), 1), 50);

        $paginator = Announcement::query()
            ->with('admin')
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate($perPage);

        return PaginatedResource::fromPaginator($paginator, fn (Announcement $a) => $this->formatAnnouncement($a));
    }

    public function store(Request $request)
    {
        $admin = $request->user();

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:160'],
            'message' => ['required', 'string', 'max:2000'],
            'audience' => ['required', 'string', Rule::in(array_map(fn ($c) => $c->value, AnnouncementAudience::cases()))],
            'publish_at' => ['nullable', 'date'],
        ]);

        $publishAt = ! empty($validated['publish_at']) ? Carbon::parse($validated['publish_at']) : null;
        $publishImmediately = $publishAt === null || $publishAt->lte(now());

        $result = DB::transaction(function () use ($admin, $validated, $publishAt, $publishImmediately, $request): array {
            $announcement = new Announcement;
            $announcement->admin_user_id = $admin->id;
            $announcement->title = trim($validated['title']);
            $announcement->message = trim($validated['message']);
            $announcement->audience = $validated['audience'];
            $announcement->publish_at = $publishAt ?? now();
            $announcement->published_at = $publishImmediately ? now() : null;
            $announcement->save();

            $deliveredCount = 0;
            if ($publishImmediately) {
                $deliveredCount = PublishScheduledAnnouncementsJob::deliverAnnouncementNotifications(
                    $announcement,
                    $this->notifications,
                );
            }

            ActivityLogger::log(
                type: ActivityLogType::Announcement,
                action: $publishImmediately ? 'announcement_published' : 'announcement_scheduled',
                actor: $admin,
                subject: $announcement,
                after: $announcement->audience()->value,
                reason: $announcement->title,
                userAgent: $request->userAgent(),
            );

            return [$announcement, $deliveredCount];
        });

        /** @var Announcement $announcement */
        [$announcement, $deliveredCount] = $result;
        $announcement->load('admin');

        $payload = $this->formatAnnouncement($announcement);
        $payload['recipients_notified'] = $deliveredCount;

        return ResponseResource::created($payload);
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
