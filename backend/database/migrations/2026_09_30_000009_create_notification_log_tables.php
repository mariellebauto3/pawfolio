<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Notifications, announcements and activity logs (ERD page 10).
 *
 * notifications is the platform's custom in-app notification channel. Each
 * row is an append-only, insert-only record: once written, a row is never
 * modified or hard-deleted by an owner (database guidelines §2-3, SEC-LOG-04).
 * Columns follow the BE-10 contract (NT-01–NT-09): user_id (owner), type,
 * title, body, data(payload), read_at (unread dot), dismissed_at (dismiss),
 * urgency, action_url.
 *
 * announcements and activity_logs are separate append-only tables (FR39, NFR9).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notifications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('type');
            $table->string('title');
            $table->text('body');
            $table->text('data')->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamp('dismissed_at')->nullable();
            $table->string('urgency', 16);
            $table->string('action_url', 255)->nullable();
            $table->timestamps();

            $table->index(['user_id', 'read_at']);
            $table->index('dismissed_at');
        });

        // Platform-wide messages from admins (FR39, NT-04–05).
        Schema::create('announcements', function (Blueprint $table) {
            $table->id();
            // Actor link survives an admin row removal: the announcement stays
            // and shows "System" (database guidelines §2–3).
            $table->foreignId('admin_user_id')->nullable()->constrained('users')->nullOnDelete()->comment('FR39');
            $table->string('title')->comment('NT-04');
            $table->text('message')->comment('NT-04');
            $table->enum('audience', ['everyone', 'pets', 'humans'])->comment('NT-04');
            $table->timestamp('publish_at')->comment('now or scheduled (NT-04)');
            $table->timestamp('published_at')->nullable()->comment('sent to Alerts and the feed (NT-05)');
            $table->timestamps();

            $table->index('published_at');
        });

        // Append-only audit trail of admin actions and system status changes
        // (NFR9, LG-01–04, SEC-LOG-01–04). No update or delete endpoints.
        Schema::create('activity_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->nullOnDelete()->comment('null means System (LG-03)');
            $table->enum('type', [
                'verification', 'account', 'status_change', 'request', 'meet_and_greet',
                'adoption', 'feed', 'profile', 'moderation', 'announcement', 'security', 'system',
            ])->comment('log type filter (LG-01 to LG-03)');
            $table->string('action')->comment('what happened (LG-03)');
            $table->string('subject_type')->nullable()->comment('target model (LG-04)');
            $table->unsignedBigInteger('subject_id')->nullable()->comment('target id (LG-04)');
            $table->string('before_value')->nullable()->comment('status before (LG-04)');
            $table->string('after_value')->nullable()->comment('status after (LG-04)');
            $table->text('reason')->nullable()->comment('required for admin actions (NFR9)');
            $table->string('user_agent')->nullable()->comment('sign-in device (LG-01)');
            $table->timestamps();

            $table->index(['type', 'created_at']);
            $table->index(['actor_user_id', 'created_at']);
            $table->index(['subject_type', 'subject_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('activity_logs');
        Schema::dropIfExists('announcements');
    }
};
