<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Community feed (ERD page 8): one shuffled feed for everyone (FD-01, FD-02).
 * A for_hire post is created automatically when a pet's résumé is published
 * (PR-10). Adoption stories are written by Furparents about a pet they adopted
 * (FR14, FD-04). Authors delete their own posts (FD-07); admins remove reported
 * content, which can be restored (RP-05).
 *
 * Post type enum values follow the LoFi feed post badges (FD-01, FD-04).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('posts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('author_user_id')->constrained('users')->cascadeOnDelete()->comment('pet or human account (FR17, FR29)');
            $table->enum('type', ['for_hire', 'hired', 'update', 'post', 'adoption_story'])->comment('post type badge (FD-01)');
            $table->string('title')->nullable()->comment('adoption story only (FD-04)');
            $table->text('body')->comment('FD-03, FD-04');
            $table->foreignId('adopted_pet_id')->nullable()->constrained('pets')->nullOnDelete()->comment('adoption story\'s adopted pet (FD-04)');
            $table->timestamp('removed_at')->nullable()->comment('removed by an admin, restorable (RP-05)');
            $table->timestamp('deleted_at')->nullable()->comment('deleted by the author (FD-07)');
            $table->timestamps();

            $table->index('created_at'); // feed, newest first (FD-01)
            $table->index(['author_user_id', 'created_at']);
            $table->index('type'); // feed type filter
        });

        Schema::create('post_photos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('post_id')->constrained()->cascadeOnDelete();
            $table->string('file_path')->comment('FD-03, FD-04');
            $table->integer('sort_order');
            $table->timestamps();

            $table->index(['post_id', 'sort_order']);
        });

        // Threaded comments: parent_comment_id set for a reply (FD-05).
        Schema::create('comments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('post_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete()->comment('author (FR17)');
            $table->foreignId('parent_comment_id')->nullable()->constrained('comments')->cascadeOnDelete()->comment('set for a reply (FD-05)');
            $table->text('body');
            $table->timestamp('removed_at')->nullable()->comment('removed by an admin, restorable (RP-05)');
            $table->timestamps();

            $table->index(['post_id', 'created_at']);
            $table->index('parent_comment_id');
            $table->index('user_id');
        });

        // Likes: post_id or comment_id set, never both (FD-05).
        Schema::create('reactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete()->comment('FR17');
            $table->foreignId('post_id')->nullable()->constrained()->cascadeOnDelete()->comment('like on a post (FD-05)');
            $table->foreignId('comment_id')->nullable()->constrained()->cascadeOnDelete()->comment('like on a comment (FD-05)');
            $table->timestamps();

            $table->unique(['user_id', 'post_id']); // one like per user per post
            $table->unique(['user_id', 'comment_id']); // one like per user per comment
            $table->index('post_id');
            $table->index('comment_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reactions');
        Schema::dropIfExists('comments');
        Schema::dropIfExists('post_photos');
        Schema::dropIfExists('posts');
    }
};
