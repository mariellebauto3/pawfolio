<?php

declare(strict_types=1);

use App\Http\Controllers\Api\V1\Analytics\AnalyticsController;
use Illuminate\Support\Facades\Route;

// Member Stats & Admin Analytics Dashboard API (BE-25, AN-01..AN-03)
Route::middleware(['auth:sanctum', 'active'])->group(function (): void {
    Route::get('stats', [AnalyticsController::class, 'stats'])->name('stats');

    Route::middleware('role:admin')->prefix('admin')->group(function (): void {
        Route::get('dashboard', [AnalyticsController::class, 'adminDashboard'])
            ->name('admin.dashboard');
    });
});
