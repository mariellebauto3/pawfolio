<?php

declare(strict_types=1);

use App\Http\Controllers\Api\V1\Profiles\HomeProfileController;
use App\Http\Controllers\Api\V1\Profiles\PetResumeController;
use Illuminate\Support\Facades\Route;

// Pet Resume API (BE-11) & Home Profile / 6-Step Quiz API (BE-12)
Route::middleware(['auth:sanctum', 'active'])->prefix('me')->group(function (): void {
    // Pet owner routes
    Route::middleware('role:pet')->group(function (): void {
        Route::get('pet', [PetResumeController::class, 'show'])->name('me.pet.show');
        Route::patch('pet', [PetResumeController::class, 'update'])
            ->middleware('throttle:writes')
            ->name('me.pet.update');
        Route::post('pet/photos', [PetResumeController::class, 'addPhoto'])
            ->middleware('throttle:writes')
            ->name('me.pet.photos.store');
        Route::patch('pet/photos/order', [PetResumeController::class, 'reorderPhotos'])
            ->middleware('throttle:writes')
            ->name('me.pet.photos.reorder');
        Route::delete('pet/photos/{photo}', [PetResumeController::class, 'deletePhoto'])
            ->middleware('throttle:writes')
            ->name('me.pet.photos.destroy');
        Route::post('pet/cover-photo', [PetResumeController::class, 'updateCoverPhoto'])
            ->middleware('throttle:writes')
            ->name('me.pet.cover-photo');
        Route::post('pet/vet-records', [PetResumeController::class, 'addVetRecord'])
            ->middleware('throttle:writes')
            ->name('me.pet.vet-records.store');
        Route::delete('pet/vet-records/{record}', [PetResumeController::class, 'deleteVetRecord'])
            ->middleware('throttle:writes')
            ->name('me.pet.vet-records.destroy');
        Route::post('pet/publish', [PetResumeController::class, 'publish'])
            ->middleware('throttle:writes')
            ->name('me.pet.publish');
    });

    // Furparent Home Profile routes
    Route::middleware('role:furparent')->group(function (): void {
        Route::get('home-profile', [HomeProfileController::class, 'show'])->name('me.home-profile.show');
        Route::patch('home-profile', [HomeProfileController::class, 'updateStep'])
            ->middleware('throttle:writes')
            ->name('me.home-profile.update');
        Route::patch('home-profile/intro', [HomeProfileController::class, 'updateIntro'])
            ->middleware('throttle:writes')
            ->name('me.home-profile.intro');
        Route::post('home-profile/intro', [HomeProfileController::class, 'updateIntro'])
            ->middleware('throttle:writes')
            ->name('me.home-profile.intro.post');
        Route::patch('home-profile/{step}', [HomeProfileController::class, 'updateStep'])
            ->middleware('throttle:writes')
            ->name('me.home-profile.step');
        Route::post('open-to-adopt', [HomeProfileController::class, 'toggleOpenToAdopt'])
            ->middleware('throttle:writes')
            ->name('me.open-to-adopt');
    });
});
