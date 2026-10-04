<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Notifications;

use App\Actions\Notifications\SendNotification;
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

        $category = $request->query('category');
        if (is_string($category) && trim($category) !== '' && strtolower(trim($category)) !== 'all') {
            $normalized = strtolower(trim($category));
            $typesForCategory = match ($normalized) {
                'requests', 'request' => [
                    'invite_sent', 'invite_received', 'request_received', 'request_withdrawn',
                    'request_approved', 'request_declined', 'request_expired', 'request_on_hold',
                    'request_under_review', 'adoption_complete', 'not_adopted',
                ],
                'meet & greets', 'meet_and_greets', 'meet-and-greets' => [
                    'meet_greet_booked', 'meet_greet_confirmed', 'meet_greet_rescheduled',
                    'meet_greet_cancelled', 'meet_greet_reminder', 'decision_needed',
                ],
                'account' => [
                    'verification_approved', 'verification_denied', 'account_action',
                    'account_suspended', 'account_reactivated', 'report_outcome', 'announcement',
                ],
                default => [],
            };

            $canonicalCategory = match ($normalized) {
                'requests', 'request' => 'Requests',
                'meet & greets', 'meet_and_greets', 'meet-and-greets' => 'Meet & Greets',
                'account' => 'Account',
                default => trim($category),
            };

            $query->where(function ($q) use ($typesForCategory, $canonicalCategory) {
                if (! empty($typesForCategory)) {
                    $q->whereIn('type', $typesForCategory)
                        ->orWhere('data->category', $canonicalCategory);
                } else {
                    $q->where('data->category', $canonicalCategory);
                }
            });
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
