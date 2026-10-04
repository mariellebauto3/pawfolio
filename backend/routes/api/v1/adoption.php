<?php

declare(strict_types=1);

use App\Http\Controllers\Api\V1\Adoption\AdminAdoptionController;
use App\Http\Controllers\Api\V1\Adoption\AdoptionController;
use Illuminate\Support\Facades\Route;

// Post-Meeting Adoption Decisions & Alumni + Admin Resolution API (BE-18, BE-20, AL-01..AL-09)
Route::middleware(['auth:sanctum', 'active'])->group(function (): void {
    Route::post('adoption-requests/{adoptionRequest}/adopt', [AdoptionController::class, 'adopt'])
        ->whereNumber('adoptionRequest')
        ->middleware('throttle:writes')
        ->name('adoption-requests.adopt');
    Route::post('adoption-requests/{adoptionRequest}/decline-after-meeting', [AdoptionController::class, 'declineAfterMeeting'])
        ->whereNumber('adoptionRequest')
        ->middleware('throttle:writes')
        ->name('adoption-requests.decline-after-meeting');

    Route::get('adoptions/{adoption}', [AdoptionController::class, 'show'])
        ->whereNumber('adoption')
        ->name('adoptions.show');

    Route::middleware('role:admin')->prefix('admin')->group(function (): void {
        Route::post('adoptions/{pet}/resolve/preview', [AdminAdoptionController::class, 'resolvePreview'])
            ->whereNumber('pet')
            ->name('admin.adoptions.resolve.preview');
        Route::post('adoptions/{pet}/resolve', [AdminAdoptionController::class, 'resolve'])
            ->whereNumber('pet')
            ->middleware('throttle:writes')
            ->name('admin.adoptions.resolve');
        Route::get('alumni', [AdminAdoptionController::class, 'alumniIndex'])
            ->name('admin.alumni.index');
    });
});
