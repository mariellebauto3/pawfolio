<?php

use App\Http\Controllers\Api\V1\Auth\AuthController;
use App\Http\Middleware\EnsureAccountIsActive;
use Illuminate\Support\Facades\Route;

/*
 * Authentication & Verification (module 1).
 *
 * Contract: docs/api/auth.md and docs/api/README.md. These endpoints are the
 * session backbone: the frontend SessionProvider + proxy.ts call GET /auth/me
 * on every navigation, and sign in / out through these.
 *
 * Role for each endpoint:
 *   auth  = any authenticated role (pet, human, admin).
 *   admin = the admin account-create command only (SEC-AUTH-10).
 */

// ── Current user ────────────────────────────────────────────────────────────────

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/auth/me', [AuthController::class, 'me'])
        ->name('auth.me')
        ->withoutMiddleware([EnsureAccountIsActive::class]);
});

// ── Sign in / sign out ──────────────────────────────────────────────────────────

Route::post('/auth/sign-in', [AuthController::class, 'signIn'])
    ->name('auth.sign-in')
    ->middleware('throttle:sign-in');

Route::post('/auth/sign-out', [AuthController::class, 'signOut'])
    ->name('auth.sign-out');

// ── Forgot / reset password ─────────────────────────────────────────────────────

Route::post('/auth/forgot-password', [AuthController::class, 'forgotPassword'])
    ->name('auth.forgot-password')
    ->middleware('throttle:forgot-password');

Route::post('/auth/reset-password', [AuthController::class, 'resetPassword'])
    ->name('auth.reset-password')
    ->middleware('throttle:reset-password');

// ── Admin: create accounts only, SEC-AUTH-10 ────────────────────────────────────

Route::prefix('admin')->middleware('auth:sanctum')->group(function () {
    Route::post('/users', [AuthController::class, 'createUser'])
        ->name('auth.admin.create-user')
        ->middleware('can:create,App\\Models\\User');
});
