<?php

use App\Http\Controllers\Api\V1\Auth\AccountStatusController;
use App\Http\Controllers\Api\V1\Auth\AdminVerificationController;
use App\Http\Controllers\Api\V1\Auth\AuthController;
use App\Http\Controllers\Api\V1\Auth\SignUpController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Module 1 — Authentication & Verification (BE-03, BE-04, BE-06, BE-08)
|--------------------------------------------------------------------------
*/

Route::post('auth/sign-in', [AuthController::class, 'signIn'])
    ->middleware('throttle:sign-in');
Route::post('auth/sign-out', [AuthController::class, 'signOut']);

Route::post('auth/sign-up/pet', [SignUpController::class, 'signUpPet'])
    ->middleware('throttle:signup');
Route::post('auth/sign-up/human', [SignUpController::class, 'signUpHuman'])
    ->middleware('throttle:signup');

Route::post('auth/forgot-password', [AuthController::class, 'forgotPassword'])
    ->middleware('throttle:forgot-password');
Route::post('auth/reset-password', [AuthController::class, 'resetPassword'])
    ->middleware('throttle:reset-password');

// Exempt from EnsureAccountIsActive so Pending, Denied, and Suspended accounts
// can load their identity, view their status, and resubmit (SEC-AUTHZ-06, AU-18..AU-21).
Route::middleware('auth:sanctum')->group(function (): void {
    Route::get('auth/me', [AuthController::class, 'me']);

    Route::get('account-status', [AccountStatusController::class, 'status']);
    Route::get('account/submission', [AccountStatusController::class, 'showSubmission']);
    Route::patch('account/submission', [AccountStatusController::class, 'updateSubmission'])
        ->middleware('throttle:writes');
    Route::post('account/submission', [AccountStatusController::class, 'updateSubmission'])
        ->middleware('throttle:writes');
});

// Admin verification: queue, review, documents, approve and deny (BE-08, AU-22..AU-26, docs/api/auth.md).
Route::middleware(['auth:sanctum', 'active', 'role:admin'])
    ->prefix('admin/verifications')
    ->whereNumber(['accountId', 'documentId'])
    ->group(function (): void {
        Route::get('/', [AdminVerificationController::class, 'index']);
        Route::get('{accountId}', [AdminVerificationController::class, 'show']);
        Route::get('{accountId}/documents/{documentId}', [AdminVerificationController::class, 'document']);
        Route::post('{accountId}/approve', [AdminVerificationController::class, 'approve'])
            ->middleware('throttle:writes');
        Route::post('{accountId}/deny', [AdminVerificationController::class, 'deny'])
            ->middleware('throttle:writes');
    });
