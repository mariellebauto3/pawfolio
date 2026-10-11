<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Notifications;

use App\Actions\Notifications\SendNotification;
use App\Enums\NotificationCategory;
use App\Http\Controllers\Controller;
use App\Http\Requests\Notifications\SendNotificationRequest;
use App\Http\Resources\ErrorResource;
use App\Http\Resources\Notifications\NotificationResource;
use App\Http\Resources\ResponseResource;
use App\Models\Notification;
use App\Services\Notifications\NotificationService;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    use AuthorizesRequests;

    public function __construct(
        private readonly NotificationService $notificationService,
        private readonly SendNotification $sendNotification,
    ) {}

    public function index(Request $request)
    {
        $this->authorize('viewAny', Notification::class);

        $user = $request->user();
        $perPage = min(max((int) $request->query('per_page', $request->query('limit', 20)), 1), 50);

        $query = $user->notifications()
            ->whereNull('dismissed_at')
            ->newestFirst();

        // The tab (NT-02, NT-03): `requests`, `meet_and_greets` or `account`; no value, or `all`, lists everything.
        // It filters on the `category` column, not on a path into `data` (a text column), so it reads the same on
        // SQLite and PostgreSQL. A value that is no tab is refused, not answered with an empty list (SEC-INPUT-03).
        $requested = $request->query('category');
        if (is_string($requested) && trim($requested) !== '' && strtolower(trim($requested)) !== 'all') {
            $category = NotificationCategory::fromLabel($requested);

            if ($category === null) {
                return ErrorResource::unprocessable('The given data was invalid.', [
                    'category' => ['Choose All, Requests, Meet & Greets or Account.'],
                ])->toResponse($request);
            }

            $query->where('category', $category->value);
        }

        // Recent or earlier (NT-02, NT-03): `recent` is the last 7 days, `earlier` everything before them, however
        // long ago; no value, or `all`, lists both. Nothing is ever dropped for its age. Allow-listed like the tab.
        $period = $request->query('period');
        if (is_string($period) && trim($period) !== '' && strtolower(trim($period)) !== 'all') {
            $period = strtolower(trim($period));

            if (! in_array($period, ['recent', 'earlier'], true)) {
                return ErrorResource::unprocessable('The given data was invalid.', [
                    'period' => ['Choose All, Recent or Earlier.'],
                ])->toResponse($request);
            }

            $query->where('created_at', $period === 'recent' ? '>=' : '<', now()->subDays(Notification::RECENT_DAYS));
        }

        $notifications = $query->paginate($perPage);

        return ResponseResource::paginated(
            $notifications,
            NotificationResource::collection($notifications->items())->resolve(),
        );
    }

    public function show(Request $request, string $id)
    {
        $notification = $this->findOwnedNotification($request, $id);

        if ($notification === null) {
            return ErrorResource::notFound('Notification not found.')->toResponse($request);
        }

        return ResponseResource::make(NotificationResource::make($notification)->resolve());
    }

    public function store(SendNotificationRequest $request)
    {
        $this->authorize('create', Notification::class);

        $data = $request->validated();

        $this->sendNotification->execute(
            $request->user(),
            $data['type'],
            $data['title'],
            $data['body'],
            $data['data'] ?? [],
            $data['urgency'] ?? 'info',
            $data['action_url'] ?? null,
        );

        return ResponseResource::created(['sent' => true]);
    }

    public function markAsRead(Request $request, string $id)
    {
        $notification = $this->findOwnedNotification($request, $id);

        if ($notification === null) {
            return ErrorResource::notFound('Notification not found.')->toResponse($request);
        }

        $notification->markAsRead();

        return ResponseResource::make(NotificationResource::make($notification->fresh())->resolve());
    }

    public function markAllAsRead(Request $request)
    {
        $this->authorize('viewAny', Notification::class);

        $updated = $request->user()
            ->notifications()
            ->whereNull('dismissed_at')
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return ResponseResource::make([
            'marked_read_count' => $updated,
        ]);
    }

    public function markAsUnread(Request $request, string $id)
    {
        $notification = $this->findOwnedNotification($request, $id);

        if ($notification === null) {
            return ErrorResource::notFound('Notification not found.')->toResponse($request);
        }

        $notification->markAsUnread();

        return ResponseResource::make(NotificationResource::make($notification)->resolve());
    }

    public function destroy(Request $request, string $id)
    {
        $notification = $this->findOwnedNotification($request, $id);

        if ($notification === null) {
            return ErrorResource::notFound('Notification not found.')->toResponse($request);
        }

        $notification->dismiss();

        return ResponseResource::make(['dismissed' => true]);
    }

    public function dismiss(Request $request, string $id)
    {
        $notification = $this->findOwnedNotification($request, $id);

        if ($notification === null) {
            return ErrorResource::notFound('Notification not found.')->toResponse($request);
        }

        $notification->dismiss();

        return ResponseResource::make(['dismissed' => true]);
    }

    public function resend(Request $request, string $id)
    {
        $notification = $this->findOwnedNotification($request, $id);

        if ($notification === null) {
            return ErrorResource::notFound('Notification not found.')->toResponse($request);
        }

        if (empty($notification->data['payload'])) {
            return ErrorResource::conflict('No notification payload to resend.', 'notification_no_payload')->toResponse($request);
        }

        $this->sendNotification->execute(
            $notification->user,
            $notification->type,
            $notification->title,
            $notification->body,
            $notification->data,
            $notification->urgency,
            $notification->action_url,
        );

        return ResponseResource::make(['resend' => true, 'type' => $notification->type]);
    }

    public function retry(Request $request, string $id)
    {
        $notification = $this->findOwnedNotification($request, $id);

        if ($notification === null) {
            return ErrorResource::notFound('Notification not found.')->toResponse($request);
        }

        if ($notification->is_read) {
            return ErrorResource::conflict('Notification already read; nothing to retry.', 'notification_already_read')->toResponse($request);
        }

        return ResponseResource::make(NotificationResource::make($notification)->resolve());
    }

    public function unreadCount(Request $request)
    {
        $this->authorize('viewAny', Notification::class);

        $count = $request->user()
            ->notifications()
            ->whereNull('dismissed_at')
            ->unread()
            ->count();

        return ResponseResource::make(['unread_count' => $count]);
    }

    public function preferencesIndex(Request $request)
    {
        $this->authorize('viewAny', Notification::class);

        $user = $request->user();
        $preference = $user->notificationPreference ?? $user->createNotificationPreference();

        return ResponseResource::make($preference);
    }

    public function preferencesUpdate(Request $request)
    {
        $this->authorize('viewAny', Notification::class);

        $user = $request->user();
        $preference = $user->notificationPreference ?? $user->createNotificationPreference();

        $validated = $request->validate([
            'requests_and_invites' => ['sometimes', 'boolean'],
            'meet_and_greets' => ['sometimes', 'boolean'],
            'post_activity' => ['sometimes', 'boolean'],
            'announcements' => ['sometimes', 'boolean'],
        ]);

        $preference->update($validated);

        return ResponseResource::make($preference->fresh());
    }

    private function findOwnedNotification(Request $request, string $id): ?Notification
    {
        return Notification::query()
            ->whereKey($id)
            ->where('user_id', $request->user()->id)
            ->first();
    }
}
