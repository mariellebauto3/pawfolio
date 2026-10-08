<?php

declare(strict_types=1);

use App\Http\Controllers\Api\V1\Matching\MatchController;
use Illuminate\Support\Facades\Route;

// Compatibility Engine & Matches API (BE-13)
Route::middleware(['auth:sanctum', 'active'])->group(function (): void {
    Route::get('matches', [MatchController::class, 'index'])->name('matches.index');
    // {profile} is the other side of the pair: a pet's id for a human, a Home Profile's id for a pet.
    Route::get('matches/{profile}/breakdown', [MatchController::class, 'breakdown'])
        ->where('profile', '[0-9]{1,15}')
        ->name('matches.breakdown');
});
