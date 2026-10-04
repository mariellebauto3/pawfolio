<?php

declare(strict_types=1);

use App\Http\Controllers\Api\V1\Bookmarks\BookmarkController;
use Illuminate\Support\Facades\Route;

// Bookmarks API (BE-15)
Route::middleware(['auth:sanctum', 'active'])->group(function (): void {
    Route::get('bookmarks', [BookmarkController::class, 'index'])->name('bookmarks.index');
    Route::post('bookmarks', [BookmarkController::class, 'store'])
        ->middleware('throttle:writes')
        ->name('bookmarks.store');
    Route::delete('bookmarks/{type}/{id}', [BookmarkController::class, 'destroyByTarget'])
        ->whereNumber('id')
        ->middleware('throttle:writes')
        ->name('bookmarks.destroy-by-target');
    Route::delete('bookmarks/{bookmark}', [BookmarkController::class, 'destroy'])
        ->whereNumber('bookmark')
        ->middleware('throttle:writes')
        ->name('bookmarks.destroy');
});
