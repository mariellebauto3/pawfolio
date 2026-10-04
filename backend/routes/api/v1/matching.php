<?php

declare(strict_types=1);

use App\Http\Controllers\Api\V1\Matching\MatchController;
use Illuminate\Support\Facades\Route;

// Compatibility Engine & Matches API (BE-13)
Route::middleware(['auth:sanctum', 'active'])->group(function (): void {
    Route::get('matches', [MatchController::class, 'index'])->name('matches.index');
    Route::get('matches/{id}/breakdown', [MatchController::class, 'breakdown'])
        ->whereNumber('id')
        ->name('matches.breakdown');
});
