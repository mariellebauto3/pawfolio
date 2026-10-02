<?php

use App\Actions\Auth\SignIn;
use Illuminate\Cache\Repository as CacheStore;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\Route;

/*
 * Pawfolio API — /api/v1.
 *
 * One route file per module under routes/api/v1/ (backend-guidelines.md §1, §2).
 * The auth module is the session backbone (docs/api/auth.md).
 */

// Wire the SignIn action with the app's default cache store for production.
// Tests inject their own array-backed store, so the action is testable without
// depending on the global cache binding.
App::singleton(SignIn::class, function () {
    return new SignIn(App::make(CacheStore::class));
});

Route::prefix('v1')->group(function () {
    // One route file per module under routes/api/v1/ (backend-guidelines.md §1, §2).
    // The modules folder name (Auth, Profiles, Discovery, Matching, Bookmarks,
    // AdoptionRequests, MeetAndGreet, Adoption, Notifications, CommunityFeed,
    // Reports, Accounts, Analytics, ActivityLogs, ui) is the single source of
    // truth for both the frontend module layout (general-development-guidelines.md §3)
    // and this routing layer (backend-guidelines.md §1).
    foreach (scandir(__DIR__.'/api/v1') as $file) {
        if ($file === '.' || $file === '..') {
            continue;
        }

        $path = __DIR__.'/api/v1/'.$file;

        if (is_file($path)) {
            require $path;

            continue;
        }

        if (is_dir($path) && file_exists($path.'/routes.php')) {
            require $path.'/routes.php';

            continue;
        }

        throw new \RuntimeException("Unroutable module directory: {$path}");
    }
});

