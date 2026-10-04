<?php

declare(strict_types=1);

use App\Http\Controllers\Api\V1\Accounts\AdminAccountController;
use App\Http\Controllers\Api\V1\Accounts\SettingsController;
use Illuminate\Support\Facades\Route;

// Member Account Settings & Admin Accounts Management API (BE-23, AC-01..AC-10)
Route::middleware(['auth:sanctum', 'active'])->group(function (): void {
    Route::get('settings', [SettingsController::class, 'show'])->name('settings.show');
    Route::patch('settings', [SettingsController::class, 'update'])
        ->middleware('throttle:writes')
        ->name('settings.update');
    Route::post('settings/password', [SettingsController::class, 'changePassword'])
        ->middleware('throttle:writes')
        ->name('settings.password');
    Route::post('settings/deactivate', [SettingsController::class, 'deactivate'])
        ->middleware('throttle:writes')
        ->name('settings.deactivate');
    Route::post('settings/change-requests', [SettingsController::class, 'storeChangeRequest'])
        ->middleware('throttle:writes')
        ->name('settings.change-requests.store');

    Route::middleware('role:admin')->prefix('admin')->group(function (): void {
        Route::get('accounts', [AdminAccountController::class, 'index'])->name('admin.accounts.index');
        Route::get('accounts/{account}', [AdminAccountController::class, 'show'])
            ->whereNumber('account')
            ->name('admin.accounts.show');
        Route::post('accounts/{account}/suspend', [AdminAccountController::class, 'suspend'])
            ->whereNumber('account')
            ->middleware('throttle:writes')
            ->name('admin.accounts.suspend');
        Route::post('accounts/{account}/reactivate', [AdminAccountController::class, 'reactivate'])
            ->whereNumber('account')
            ->middleware('throttle:writes')
            ->name('admin.accounts.reactivate');
        Route::post('accounts/{account}/deactivate', [AdminAccountController::class, 'deactivate'])
            ->whereNumber('account')
            ->middleware('throttle:writes')
            ->name('admin.accounts.deactivate');

        Route::get('change-requests', [AdminAccountController::class, 'changeRequestsIndex'])
            ->name('admin.change-requests.index');
        Route::post('change-requests/{changeRequest}/review', [AdminAccountController::class, 'reviewChangeRequest'])
            ->whereNumber('changeRequest')
            ->middleware('throttle:writes')
            ->name('admin.change-requests.review');
    });
});
