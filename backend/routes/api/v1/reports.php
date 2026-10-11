<?php

declare(strict_types=1);

use App\Http\Controllers\Api\V1\Reports\ReportController;
use Illuminate\Support\Facades\Route;

// Member Reports & Admin Moderation API (BE-22, RP-01..RP-05)
Route::middleware(['auth:sanctum', 'active'])->group(function (): void {
    Route::post('reports', [ReportController::class, 'store'])
        ->middleware('throttle:writes')
        ->name('reports.store');

    Route::middleware('role:admin')->prefix('admin')->group(function (): void {
        Route::get('reports', [ReportController::class, 'adminIndex'])->name('admin.reports.index');
        Route::get('reports/{report}', [ReportController::class, 'adminShow'])
            ->whereNumber('report')
            ->name('admin.reports.show');
        Route::post('reports/{report}/actions', [ReportController::class, 'takeAction'])
            ->whereNumber('report')
            ->middleware('throttle:writes')
            ->name('admin.reports.actions');
    });
});
