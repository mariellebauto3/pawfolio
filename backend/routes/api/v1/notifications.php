<?php

declare(strict_types=1);

use App\Http\Controllers\Api\V1\Notifications\AnnouncementController;
use App\Http\Controllers\Api\V1\Notifications\NotificationController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'active'])->group(function () {
    Route::get('notifications', [NotificationController::class, 'index']);
    Route::get('notifications/unread-count', [NotificationController::class, 'unreadCount']);
    Route::post('notifications/read-all', [NotificationController::class, 'markAllAsRead']);
    Route::patch('notifications/read-all', [NotificationController::class, 'markAllAsRead']);
    Route::get('notifications/preferences', [NotificationController::class, 'preferencesIndex']);
    Route::patch('notifications/preferences', [NotificationController::class, 'preferencesUpdate']);
    Route::get('notifications/{notification}', [NotificationController::class, 'show']);
    Route::post('notifications', [NotificationController::class, 'store']);
    Route::post('notifications/{notification}/read', [NotificationController::class, 'markAsRead']);
    Route::patch('notifications/{notification}/read', [NotificationController::class, 'markAsRead']);
    Route::patch('notifications/{notification}/unread', [NotificationController::class, 'markAsUnread']);
    Route::delete('notifications/{notification}', [NotificationController::class, 'destroy']);
    Route::patch('notifications/{notification}/dismiss', [NotificationController::class, 'dismiss']);
    Route::patch('notifications/{notification}/resend', [NotificationController::class, 'resend']);
    Route::patch('notifications/{notification}/retry', [NotificationController::class, 'retry']);

    // The announcements published for the caller's role, read on the Notifications page (NT-02, NT-03).
    Route::get('announcements', [AnnouncementController::class, 'published'])
        ->name('announcements.published');

    // Admin Announcements API (BE-24, NT-04..NT-05)
    Route::middleware('role:admin')->prefix('admin')->group(function (): void {
        Route::get('announcements', [AnnouncementController::class, 'index'])
            ->name('admin.announcements.index');
        Route::post('announcements', [AnnouncementController::class, 'store'])
            ->middleware('throttle:writes')
            ->name('admin.announcements.store');
    });
});
