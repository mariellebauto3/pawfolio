<?php

declare(strict_types=1);

use App\Http\Controllers\Api\V1\ActivityLogs\ActivityLogController;
use Illuminate\Support\Facades\Route;

// Member Activity & Admin Activity Logs + CSV Export API (BE-26, LG-01..LG-04)
Route::middleware(['auth:sanctum', 'active'])->group(function (): void {
    Route::get('activity', [ActivityLogController::class, 'myActivity'])->name('activity.index');
    Route::get('activity/export', [ActivityLogController::class, 'exportMyActivity'])->name('activity.export');

    Route::middleware('role:admin')->prefix('admin')->group(function (): void {
        Route::get('activity-logs', [ActivityLogController::class, 'adminIndex'])
            ->name('admin.activity-logs.index');
        Route::get('activity-logs/export', [ActivityLogController::class, 'adminExport'])
            ->name('admin.activity-logs.export');
        Route::get('activity-logs/{activityLog}', [ActivityLogController::class, 'adminShow'])
            ->whereNumber('activityLog')
            ->name('admin.activity-logs.show');
    });
});
