<?php

declare(strict_types=1);

use App\Http\Controllers\Api\V1\Adoption\AdminAdoptionController;
use App\Http\Controllers\Api\V1\MeetAndGreet\MeetAndGreetController;
use App\Http\Controllers\Api\V1\MeetAndGreet\MeetGreetSlotController;
use Illuminate\Support\Facades\Route;

// Meet & Greet Availability Slots & Bookings API (BE-17, MG-01..MG-15)
Route::middleware(['auth:sanctum', 'active'])->group(function (): void {
    Route::get('meet-greet-slots', [MeetGreetSlotController::class, 'index'])->name('meet-greet-slots.index');
    Route::post('meet-greet-slots', [MeetGreetSlotController::class, 'store'])
        ->middleware('throttle:writes')
        ->name('meet-greet-slots.store');
    Route::delete('meet-greet-slots/{slot}', [MeetGreetSlotController::class, 'destroy'])
        ->whereNumber('slot')
        ->middleware('throttle:writes')
        ->name('meet-greet-slots.destroy');

    Route::post('adoption-requests/{adoptionRequest}/meet-and-greet', [MeetAndGreetController::class, 'book'])
        ->whereNumber('adoptionRequest')
        ->middleware('throttle:writes')
        ->name('adoption-requests.meet-and-greet.book');
    Route::post('adoption-requests/{adoptionRequest}/meet-and-greet/confirm', [MeetAndGreetController::class, 'confirm'])
        ->whereNumber('adoptionRequest')
        ->middleware('throttle:writes')
        ->name('adoption-requests.meet-and-greet.confirm');
    Route::post('adoption-requests/{adoptionRequest}/meet-and-greet/propose-time', [MeetAndGreetController::class, 'proposeTime'])
        ->whereNumber('adoptionRequest')
        ->middleware('throttle:writes')
        ->name('adoption-requests.meet-and-greet.propose-time');
    Route::post('adoption-requests/{adoptionRequest}/meet-and-greet/reschedule', [MeetAndGreetController::class, 'reschedule'])
        ->whereNumber('adoptionRequest')
        ->middleware('throttle:writes')
        ->name('adoption-requests.meet-and-greet.reschedule');
    Route::post('adoption-requests/{adoptionRequest}/meet-and-greet/cancel', [MeetAndGreetController::class, 'cancel'])
        ->whereNumber('adoptionRequest')
        ->middleware('throttle:writes')
        ->name('adoption-requests.meet-and-greet.cancel');
    Route::post('adoption-requests/{adoptionRequest}/meet-and-greet/didnt-happen', [MeetAndGreetController::class, 'didntHappen'])
        ->whereNumber('adoptionRequest')
        ->middleware('throttle:writes')
        ->name('adoption-requests.meet-and-greet.didnt-happen');

    Route::middleware('role:admin')->prefix('admin')->group(function (): void {
        Route::get('meet-and-greets', [AdminAdoptionController::class, 'meetAndGreetsIndex'])
            ->name('admin.meet-and-greets.index');
    });
});
