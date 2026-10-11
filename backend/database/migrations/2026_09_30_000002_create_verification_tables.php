<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Verification flow (ERD page 3): every Pet and Human account starts as
 * pending_verification (§2, §5.1). An admin approves or denies each submission.
 * A denied owner edits their details and resubmits, which creates a new
 * submission (AU-19, AU-20, AU-24). The submitted details themselves live in
 * pets (pet sign-up) or home_profiles (human sign-up); a submission only
 * records the review round and its documents.
 *
 * History rows (submissions, documents, change requests, account actions)
 * stay even if the account row is removed (database guidelines §2–3);
 * admin "reviewed by" links are nullable so the record stays and shows
 * "System" instead of being erased with the admin.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Admin review of one sign-up or resubmission round (AU-22–26, FR33).
        Schema::create('verification_submissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete()->comment('account being verified');
            $table->enum('status', ['pending', 'approved', 'denied'])->default('pending');
            $table->timestamp('submitted_at')->nullable()->comment('sign-up submit or resubmit (AU-12, AU-17, AU-19)');
            $table->foreignId('reviewed_by_user_id')->nullable()->constrained('users')->nullOnDelete()->comment('admin who decided (AU-23, AU-24)');
            $table->timestamp('reviewed_at')->nullable();
            $table->enum('denial_reason', [
                'id_photo_unreadable', 'name_mismatch', 'id_expired', 'under_18', 'other',
            ])->nullable()->comment('required when denied (AU-25, FR33)');
            $table->text('message_to_owner')->nullable()->comment('shown on the Denied screen (AU-20)');
            $table->timestamps();

            $table->index('user_id'); // a user's resubmission rounds (AU-19); Postgres does not index FKs automatically
            $table->index('status');
            $table->index(['status', 'submitted_at']); // verification queue, oldest first (AU-22)
            $table->index('reviewed_by_user_id');
        });

        // Files uploaded with a submission: valid ID, pet photo or vet record.
        // Only the path is stored — documents live on the private disk, admin-only (SEC-PRIV-01, NFR4).
        Schema::create('verification_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('verification_submission_id')->constrained()->cascadeOnDelete()->comment('submission the file was uploaded with');
            $table->enum('document_type', ['valid_id', 'pet_photo', 'vet_record_or_certificate']);
            $table->enum('id_type', [
                'drivers_license', 'passport', 'umid', 'national_id_philsys', 'postal_id',
            ])->nullable()->comment('human ID type (AU-16)');
            $table->string('file_path')->comment('private disk, admins only (NFR4)');
            $table->string('mime_type')->comment('JPG, PNG or PDF (AU-10)');
            $table->integer('size_bytes')->comment('max 5 MB (AU-10)');
            $table->timestamps();

            $table->index('verification_submission_id');
            $table->index('document_type');
        });

        // Owner asks an admin to change a locked, verified field (AC-03, AU-09).
        Schema::create('detail_change_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete()->comment('owner asking for the change (AC-03)');
            $table->string('field')->comment('locked field to change');
            $table->string('new_value');
            $table->text('reason');
            $table->string('document_path')->nullable()->comment('supporting document, private disk');
            $table->enum('status', ['pending', 'approved', 'denied'])->default('pending');
            $table->foreignId('reviewed_by_user_id')->nullable()->constrained('users')->nullOnDelete()->comment('admin');
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();

            $table->index('status');
            $table->index(['user_id', 'status']);
        });

        // Owner self-deactivation or admin suspend/reactivate/deactivate (FR34, AC-05, AC-08–10).
        Schema::create('account_actions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->restrictOnDelete()->comment('account acted on');
            $table->foreignId('performed_by_user_id')->nullable()->constrained('users')->nullOnDelete()->comment('admin, or the owner for self-deactivation; null keeps the record if the actor row is removed');
            $table->enum('action', ['suspend', 'reactivate', 'deactivate'])->comment('FR34');
            $table->text('reason')->nullable()->comment('only for owner deactivation (AC-05); required for admins (AC-08 to AC-10)');
            $table->timestamps();

            $table->index(['user_id', 'created_at']); // account history (LG-04)
            $table->index('performed_by_user_id');
        });

        // One row per account: notification preference toggles (AC-01, AC-02).
        Schema::create('notification_preferences', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete()->comment('one row per account');
            $table->boolean('requests_and_invites')->default(true)->comment('adoption requests and invites (AC-01, AC-02)');
            $table->boolean('meet_and_greets')->default(true)->comment('Meet and Greet bookings and reminders');
            $table->boolean('post_activity')->default(true)->comment('reactions and comments on my posts');
            $table->boolean('announcements')->default(true)->comment('announcements from Pawfolio');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notification_preferences');
        Schema::dropIfExists('account_actions');
        Schema::dropIfExists('detail_change_requests');
        Schema::dropIfExists('verification_documents');
        Schema::dropIfExists('verification_submissions');
    }
};
