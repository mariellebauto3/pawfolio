<?php

declare(strict_types=1);

use App\Http\Controllers\Api\V1\Discovery\DiscoveryController;
use Illuminate\Support\Facades\Route;

// Discovery, Search & Public Recently-Hired API (BE-14)
Route::get('public/recently-hired', [DiscoveryController::class, 'recentlyHired'])
    ->name('public.recently-hired');

Route::middleware(['auth:sanctum', 'active'])->group(function (): void {
    Route::get('pets', [DiscoveryController::class, 'browsePets'])->name('pets.index');
    Route::get('pets/{pet}', [DiscoveryController::class, 'showPet'])
        ->whereNumber('pet')
        ->name('pets.show');
    Route::get('pets/{pet}/vet-records/{record}', [DiscoveryController::class, 'downloadVetRecord'])
        ->whereNumber('pet')
        ->whereNumber('record')
        ->name('pets.vet-records.download');

    Route::get('home-profiles', [DiscoveryController::class, 'browseHomeProfiles'])->name('home-profiles.index');
    Route::get('home-profiles/{home}', [DiscoveryController::class, 'showHomeProfile'])
        ->whereNumber('home')
        ->name('home-profiles.show');

    Route::get('search', [DiscoveryController::class, 'search'])->name('search');
});
