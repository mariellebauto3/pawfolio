<?php

declare(strict_types=1);

use App\Http\Controllers\Api\V1\CommunityFeed\CommunityFeedController;
use Illuminate\Support\Facades\Route;

// Community Feed, Posts, Adoption Stories, Comments & Reactions API (BE-21, FD-01..FD-07)
Route::middleware(['auth:sanctum', 'active'])->group(function (): void {
    Route::get('feed', [CommunityFeedController::class, 'index'])->name('feed.index');
    Route::get('posts/{post}', [CommunityFeedController::class, 'show'])
        ->whereNumber('post')
        ->name('posts.show');
    Route::post('posts', [CommunityFeedController::class, 'store'])
        ->middleware('throttle:writes')
        ->name('posts.store');
    Route::post('posts/adoption-story', [CommunityFeedController::class, 'storeAdoptionStory'])
        ->middleware('throttle:writes')
        ->name('posts.adoption-story.store');
    Route::patch('posts/{post}', [CommunityFeedController::class, 'update'])
        ->whereNumber('post')
        ->middleware('throttle:writes')
        ->name('posts.update');
    Route::delete('posts/{post}', [CommunityFeedController::class, 'destroy'])
        ->whereNumber('post')
        ->middleware('throttle:writes')
        ->name('posts.destroy');

    Route::post('posts/{post}/comments', [CommunityFeedController::class, 'storeComment'])
        ->whereNumber('post')
        ->middleware('throttle:writes')
        ->name('posts.comments.store');
    Route::delete('comments/{comment}', [CommunityFeedController::class, 'destroyComment'])
        ->whereNumber('comment')
        ->middleware('throttle:writes')
        ->name('comments.destroy');

    Route::post('posts/{post}/reactions', [CommunityFeedController::class, 'togglePostReaction'])
        ->whereNumber('post')
        ->middleware('throttle:writes')
        ->name('posts.reactions.toggle');
    Route::post('comments/{comment}/reactions', [CommunityFeedController::class, 'toggleCommentReaction'])
        ->whereNumber('comment')
        ->middleware('throttle:writes')
        ->name('comments.reactions.toggle');
});
