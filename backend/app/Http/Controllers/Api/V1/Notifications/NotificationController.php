<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Notifications;

use App\Events\Notifications\NotificationSent;
use App\Http\Controllers\Controller;
use App\Http\Resources\Notifications\NotificationResource;
use App\Models\Notification;
use App\Models\NotificationPreference;
use App\Models\User;
use App\Services\Notifications\NotificationService;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Notifications (module 16).
 *
 * FR31 / NT-01–NT-09. The authenticated user's database-channel notification
 * threads. Every endpoint is auth:sanctum; the owner reads, updates and
 * dismisses only their own threads. Notification threads are append-only:
 * a row is inserted once and only the owner can flip the read/dismiss flags.
 * Resend duplicates the stored payload into the queue (NT-07). Preferences
 * gate category-level deliveries (NT-08).
 *
 * @mixin Notification
 */
class NotificationController extends Controller
{
    public function __construct(
        private readonly NotificationService $notificationService,
    ) {}

    /** GET /api/v1/notifications — index (FR31, NT-01). */
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Notification::class);

        $perPage = (int) $request->input('per_page', 20);
        $perPage = max(1, min($perPage, 100));

        $query = Notification::forUser($request->user()->id)
            ->newestFirst();

        $paginator = $query->paginate($perPage);

        /** @var LengthAwarePaginator $paginator */
        return response()->json([
            'data' => $paginator->getCollection()->map(fn (Notification $n) => NotificationResource::make($n)),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'total_pages' => $paginator->lastPage(),
                'unread_count' => (clone $query)->unread()->whereNull('dismissed_at')->count(),
            ],
            'links' => [
                'first' => $paginator->url(1),
                'last' => $paginator->url($paginator->lastPage()),
                'prev' => $paginator->previousPageUrl(),
                'next' => $paginator->nextPageUrl(),
            ],
        ]);
    }

    /** GET /api/v1/notifications/{id} — show (FR31). */
    public function show(Request $request, string $id): JsonResponse
    {
        $notification = $this->findOwnNotification($request->user(), $id);

        return response()->json([
            'data' => NotificationResource::make($notification),
        ]);
    }

    /** PATCH /api/v1/notifications/{id}/read — markAsRead (NT-02). */
    public function markAsRead(Request $request, string $id): JsonResponse
    {
        error_log('MARK_AS_READ CALLED');

        $notification = $this->findOwnNotification($request->user(), $id);

        $this->authorize('markAsRead', $notification);

        DB::transaction(function () use ($notification) {
            $notification->markAsRead();

            // Mark sibling unread threads read too (NT-02).
            $notification->user->notifications()
                ->unread()
                ->where('created_at', '<=', $notification->created_at)
                ->whereNotNull('read_at')
                ->get()
                ->each->markAsRead();
        });

        return response()->json([
            'data' => NotificationResource::make($notification),
        ]);
    }

    /** PATCH /api/v1/notifications/{id}/unread — markAsUnread (NT-03). */
    public function markAsUnread(Request $request, string $id): JsonResponse
    {
        $notification = $this->findOwnNotification($request->user(), $id);

        $this->authorize('markAsUnread', $notification);

        $notification->markAsUnread();

        return response()->json([
            'data' => NotificationResource::make($notification),
        ]);
    }

    /** DELETE /api/v1/notifications/{id} — dismiss (NT-06). */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $notification = $this->findOwnNotification($request->user(), $id);

        $this->authorize('delete', $notification);

        $notification->dismiss();

        return response()->json([
            'data' => ['dismissed' => true, 'id' => $notification->id],
        ]);
    }

    /** PATCH /api/v1/notifications/{id}/dismiss — dismiss (NT-06). */
    public function dismiss(Request $request, string $id): JsonResponse
    {
        $notification = $this->findOwnNotification($request->user(), $id);

        $this->authorize('dismiss', $notification);

        $notification->dismiss();

        return response()->json([
            'data' => NotificationResource::make($notification),
        ]);
    }

    /** PATCH /api/v1/notifications/{id}/resend — resend (NT-07). */
    public function resend(Request $request, string $id): JsonResponse
    {
        $notification = $this->findOwnNotification($request->user(), $id);

        $this->authorize('resend', $notification);

        $payload = $notification->data['payload'] ?? null;

        if ($payload === null) {
            return response()->json([
                'message' => 'Nothing to resend: the notification has no stored payload.',
            ], 409);
        }

        // Re-queue the stored payload so the worker re-delivers it (NT-07).
        // The queued listener (WriteNotification) owns actual delivery and
        // honours the user's notification-preference toggles (NT-08).
        // Re-queue the stored payload so the worker re-delivers it (NT-07).
        // The queued listener (WriteNotification) owns actual delivery and
        // honours the user's notification-preference toggles (NT-08).
        NotificationSent::dispatch(
            $notification->user,
            $notification->type,
            $notification->title,
            $notification->body,
            $payload,
            $notification->urgency,
            $notification->action_url,
        );

        return response()->json([
            'data' => [
                'resend' => true,
                'queued_for' => $request->user()->display_name ?? $request->user()->email,
                'type' => $notification->type,
            ],
        ]);
    }

    /** GET /api/v1/notifications/unread-count — unread (NT-01). */
    public function unreadCount(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Notification::class);

        $count = Notification::forUser($request->user()->id)
            ->unread()
            ->whereNull('dismissed_at')
            ->count();

        return response()->json(['data' => ['unread_count' => $count]]);
    }

    /** GET /api/v1/notifications/preferences — index (NT-08). */
    public function preferencesIndex(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Notification::class);

        $preference = $request->user()->notificationPreference
            ?? new NotificationPreference;

        return response()->json([
            'data' => [
                'requests_and_invites' => $preference->shouldRequestAndInvite(),
                'meet_and_greets' => $preference->shouldMeetAndGreet(),
                'post_activity' => $preference->shouldPostActivity(),
                'announcements' => $preference->shouldAnnouncements(),
            ],
        ]);
    }

    /** PATCH /api/v1/notifications/preferences — update (NT-08). */
    public function preferencesUpdate(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Notification::class);

        $validated = $request->validate([
            'requests_and_invites' => 'sometimes|boolean',
            'meet_and_greets' => 'sometimes|boolean',
            'post_activity' => 'sometimes|boolean',
            'announcements' => 'sometimes|boolean',
        ]);

        $preference = $request->user()->notificationPreference
            ?? $request->user()->createNotificationPreference();

        foreach ($validated as $field => $value) {
            $preference->{$field} = (bool) $value;
        }

        $preference->save();

        return response()->json([
            'data' => [
                'requests_and_invites' => $preference->shouldRequestAndInvite(),
                'meet_and_greets' => $preference->shouldMeetAndGreet(),
                'post_activity' => $preference->shouldPostActivity(),
                'announcements' => $preference->shouldAnnouncements(),
            ],
        ]);
    }

    private function findOwnNotification(User $user, string $id): Notification
    {
        error_log('FON CALLED user_id='.$user->id.' id='.$id);
        $notification = Notification::where('id', $id)
            ->where('user_id', $user->id)
            ->first();

        if ($notification === null) {

            throw new NotFoundHttpException('Notification not found.');
        }

        return $notification;
    }
}
