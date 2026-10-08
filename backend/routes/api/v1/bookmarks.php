<?php

declare(strict_types=1);

use App\Http\Controllers\Api\V1\Bookmarks\BookmarkController;
use Illuminate\Support\Facades\Route;

// Bookmarks API (BE-15): a human saves pets, a pet saves homes. An admin has none.
Route::middleware(['auth:sanctum', 'active', 'role:pet,human'])->group(function (): void {
    Route::get('bookmarks', [BookmarkController::class, 'index'])->name('bookmarks.index');
    Route::post('bookmarks', [BookmarkController::class, 'store'])
        ->middleware('throttle:writes')
        ->name('bookmarks.store');

    // By the profile saved, which is all a resume or a Home Profile page knows.
    Route::delete('bookmarks/pets/{pet}', [BookmarkController::class, 'destroyPet'])
        ->whereNumber('pet')
        ->middleware('throttle:writes')
        ->name('bookmarks.pets.destroy');
    Route::delete('bookmarks/home-profiles/{home}', [BookmarkController::class, 'destroyHomeProfile'])
        ->whereNumber('home')
        ->middleware('throttle:writes')
        ->name('bookmarks.home-profiles.destroy');

    Route::delete('bookmarks/{bookmark}', [BookmarkController::class, 'destroy'])
        ->whereNumber('bookmark')
        ->middleware('throttle:writes')
        ->name('bookmarks.destroy');
});
