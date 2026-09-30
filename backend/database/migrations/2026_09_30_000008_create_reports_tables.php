<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Reports and moderation (ERD page 9). Each reports row is one person's report
 * (FR16, FR32). The admin queue groups open reports by reported item, "most
 * reported first" (RP-03). One admin decision is stored as a report_actions
 * row, and every open report on that item points to it (RP-05, FR35).
 *
 * Reason enum values follow the LoFi report dialog (RP-01) and admin action
 * dialog (RP-05).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('report_actions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('admin_user_id')->constrained('users')->cascadeOnDelete()->comment('FR35');
            $table->enum('target_type', ['profile', 'post', 'comment', 'account'])->comment('same as the reports it resolves');
            $table->foreignId('reported_user_id')->constrained('users')->cascadeOnDelete()->comment('owner of the reported item (RP-04)');
            $table->foreignId('post_id')->nullable()->constrained()->nullOnDelete()->comment('set when target_type is post');
            $table->foreignId('comment_id')->nullable()->constrained()->nullOnDelete()->comment('set when target_type is comment');
            $table->enum('action', ['remove_content', 'suspend_account', 'remove_content_and_suspend', 'dismiss'])->comment('RP-05, FR35');
            $table->text('reason')->comment('required, shown to the owner (RP-05)');
            $table->boolean('notify_reporters')->comment('RP-05');
            $table->timestamps();

            $table->index(['admin_user_id', 'created_at']);
            $table->index(['reported_user_id', 'created_at']); // account history (LG-04)
            $table->index(['target_type', 'post_id', 'comment_id']);
        });

        Schema::create('reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('reporter_user_id')->constrained('users')->cascadeOnDelete()->comment('FR16, FR32');
            $table->enum('target_type', ['profile', 'post', 'comment', 'account'])->comment('RP-01');
            $table->foreignId('reported_user_id')->constrained('users')->cascadeOnDelete()->comment('owner of the reported item (RP-04)');
            $table->foreignId('post_id')->nullable()->constrained('posts')->cascadeOnDelete()->comment('set when target_type is post');
            $table->foreignId('comment_id')->nullable()->constrained('comments')->cascadeOnDelete()->comment('set when target_type is comment');
            $table->enum('reason', [
                'fake_or_misleading_profile', 'selling_or_trading_animals', 'harassment_or_hate',
                'animal_welfare_concern', 'spam_or_scam', 'something_else',
            ])->comment('RP-01');
            $table->text('details')->nullable()->comment('RP-01');
            $table->enum('status', ['open', 'resolved'])->default('open')->comment('RP-03');
            $table->foreignId('report_action_id')->nullable()->constrained('report_actions')->nullOnDelete()->comment('set when resolved');
            $table->timestamps();

            // One open report per reporter per item (resolved reports allow
            // reporting again) is checked in the Report Action (SEC-AUTHZ-08).
            // No unique key: post_id and comment_id are null for profile and
            // account reports, and nulls are never equal, so it could not
            // guard those rows.
            $table->index(['reporter_user_id', 'target_type']); // open-report check
            $table->index('status');
            $table->index(['status', 'created_at']); // admin queue, most reported first (RP-03)
            $table->index('reported_user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reports');
        Schema::dropIfExists('report_actions');
    }
};
