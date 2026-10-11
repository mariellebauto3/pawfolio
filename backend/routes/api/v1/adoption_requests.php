<?php

declare(strict_types=1);

use App\Http\Controllers\Api\V1\Adoption\AdminAdoptionController;
use App\Http\Controllers\Api\V1\AdoptionRequests\AdoptionRequestController;
use App\Http\Controllers\Api\V1\AdoptionRequests\InviteController;
use Illuminate\Support\Facades\Route;

// Invites to Apply (BE-15) & Adoption Requests (BE-16) & Admin Monitor (BE-20)
Route::middleware(['auth:sanctum', 'active'])->group(function (): void {
    // Invites to Apply (RQ-01, RQ-02)
    Route::get('invites', [InviteController::class, 'index'])->name('invites.index');
    Route::post('pets/{pet}/invites', [InviteController::class, 'store'])
        ->whereNumber('pet')
        ->middleware('throttle:writes')
        ->name('pets.invites.store');
    Route::post('invites/{invite}/dismiss', [InviteController::class, 'dismiss'])
        ->whereNumber('invite')
        ->middleware('throttle:writes')
        ->name('invites.dismiss');

    // Adoption Requests (RQ-03..RQ-17)
    Route::get('adoption-requests', [AdoptionRequestController::class, 'index'])->name('adoption-requests.index');
    Route::get('adoption-requests/{adoptionRequest}', [AdoptionRequestController::class, 'show'])
        ->whereNumber('adoptionRequest')
        ->name('adoption-requests.show');
    Route::post('adoption-requests', [AdoptionRequestController::class, 'store'])
        ->middleware('throttle:writes')
        ->name('adoption-requests.store');
    Route::post('home-profiles/{home}/adoption-requests', [AdoptionRequestController::class, 'storeForHome'])
        ->whereNumber('home')
        ->middleware('throttle:writes')
        ->name('home-profiles.adoption-requests.store');

    Route::post('adoption-requests/{adoptionRequest}/approve', [AdoptionRequestController::class, 'approve'])
        ->whereNumber('adoptionRequest')
        ->middleware('throttle:writes')
        ->name('adoption-requests.approve');
    Route::post('adoption-requests/{adoptionRequest}/decline', [AdoptionRequestController::class, 'decline'])
        ->whereNumber('adoptionRequest')
        ->middleware('throttle:writes')
        ->name('adoption-requests.decline');
    Route::post('adoption-requests/{adoptionRequest}/withdraw', [AdoptionRequestController::class, 'withdraw'])
        ->whereNumber('adoptionRequest')
        ->middleware('throttle:writes')
        ->name('adoption-requests.withdraw');

    // Admin Adoption Requests Monitor (BE-20, RQ-18, RQ-19, MG-16)
    Route::middleware('role:admin')->prefix('admin')->group(function (): void {
        Route::get('adoption-requests', [AdminAdoptionController::class, 'requestsIndex'])
            ->name('admin.adoption-requests.index');
        Route::get('adoption-requests/{adoptionRequest}', [AdminAdoptionController::class, 'requestShow'])
            ->whereNumber('adoptionRequest')
            ->name('admin.adoption-requests.show');
        Route::post('adoption-requests/{adoptionRequest}/remind', [AdminAdoptionController::class, 'sendReminder'])
            ->whereNumber('adoptionRequest')
            ->middleware('throttle:writes')
            ->name('admin.adoption-requests.remind');
    });
});
