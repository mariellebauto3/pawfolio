<?php

declare(strict_types=1);

use App\Http\Controllers\Api\V1\Notifications\NotificationController;
use Illuminate\Support\Facades\Route;

/* Notifications (module 16).
 *
 * Contract (FR31, NT-01–NT-09): the authenticated user's database-channel
 * notification threads — index / show / read-unread toggles / dismiss / resend
 * / unread-count / preferences. Rules:
 *
 *   - Every endpoint is auth:sanctum (SEC-AUTH-01). App activities are keyed
 *     to the account that owns the thread, never an anonymous one.
 *   - The owner can read, update and dismiss only their own threads (SEC-AUTHZ-01).
 *   - Notification threads are append-only (database guidelines §2-3): a row
 *     is inserted once and only the owner can mark it read/dismissed; no
 *     hard-delete route exists (SEC-LOG-04).
 *   - Resend duplicates the stored payload into the queue (NT-07).
 *   - Preferences are read-and-updated by the owning account (NT-08).
 *
 * The {id} parameter is a ULID (the Notification model uses HasUlids). The
 * controller's findOwnNotification enforces ownership and returns the
 * not-found error, so no route-level UUID/ULID regex is required here; the
 * /preferences routes do not carry {id}, so there is no route-collision risk.
 */

Route::middleware(['auth:sanctum'])->group(function () {
    Route::get('/notifications', [NotificationController::class, 'index'])
        ->name('notifications.index');

    Route::get('/notifications/{id}', [NotificationController::class, 'show'])->whereUlid('id')
        ->name('notifications.show');

    Route::patch('/notifications/{id}/read', [NotificationController::class, 'markAsRead'])->whereUlid('id')
        ->name('notifications.mark-as-read');

    Route::patch('/notifications/{id}/unread', [NotificationController::class, 'markAsUnread'])->whereUlid('id')
        ->name('notifications.mark-as-unread');

    Route::delete('/notifications/{id}', [NotificationController::class, 'destroy'])->whereUlid('id')
        ->name('notifications.destroy');

    Route::patch('/notifications/{id}/dismiss', [NotificationController::class, 'dismiss'])->whereUlid('id')
        ->name('notifications.dismiss');

    Route::patch('/notifications/{id}/resend', [NotificationController::class, 'resend'])->whereUlid('id')
        ->name('notifications.resend');

    Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount'])
        ->name('notifications.unread-count');

    Route::get('/notifications/preferences', [NotificationController::class, 'preferencesIndex'])
        ->name('notifications.preferences.index');

    Route::patch('/notifications/preferences', [NotificationController::class, 'preferencesUpdate'])
        ->name('notifications.preferences.update');
});
