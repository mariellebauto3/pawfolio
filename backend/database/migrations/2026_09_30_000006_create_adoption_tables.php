<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Adoption requests, Meet & Greet and adoption (ERD page 7).
 *
 * adoption_requests.status follows proposal §5.3. A request can have several
 * meet_and_greets over its life: rebooking after "Propose another time" (MG-06),
 * a reschedule (MG-09), a cancellation (MG-10) or "It didn't happen" (MG-13)
 * ends the current booking and a new one is created. At most one booking per
 * request is active (booked or confirmed) at a time.
 *
 * Status enums follow proposal §5.3 (requests) and §5.4 (Meet & Greet).
 * Business limits (3 open, 1 in process, one per pair, 30-day cooldown,
 * exactly one Furparent per pet) are enforced atomically in Actions
 * (SEC-AUTHZ-08); unique constraints here back up what the database can hold.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('adoption_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pet_id')->constrained()->cascadeOnDelete()->comment('sender (FR24)');
            $table->foreignId('home_profile_id')->constrained()->cascadeOnDelete()->comment('recipient, must be Open to Adopt when sent (section 5.5)');
            $table->enum('status', [
                'sent', 'on_hold', 'approved', 'meet_scheduled', 'awaiting_decision',
                'adopted', 'declined', 'not_adopted', 'withdrawn', 'closed', 'expired',
            ])->default('sent')->comment('request status, system-set only (section 5.3)');
            $table->text('cover_letter')->comment('Why I would fit your home, 50 to 600 chars (RQ-03)');
            $table->text('caretaker_notes')->nullable()->comment('RQ-03');
            $table->text('approval_message')->nullable()->comment('optional message (RQ-12, FR10)');
            $table->enum('decline_reason', [
                'not_right_fit', 'not_adopting_now', 'another_pet_joining', 'other',
            ])->nullable()->comment('optional (RQ-13)');
            $table->text('decision_message')->nullable()->comment('decline message (RQ-13) or message after the meeting (MG-14)');
            $table->enum('withdraw_reason', [
                'found_better_match', 'caretaker_cant_make_schedule', 'pet_no_longer_available', 'other',
            ])->nullable()->comment('optional (RQ-16)');
            $table->timestamp('sent_at')->nullable()->comment('RQ-03');
            $table->timestamp('expires_at')->nullable()->comment('sent plus 14 days, or approved plus 14 days without booking (section 5.3, MG-03)');
            $table->timestamp('approved_at')->nullable()->comment('RQ-12');
            $table->timestamp('meet_scheduled_at')->nullable()->comment('booking confirmed (MG-05)');
            $table->timestamp('awaiting_decision_at')->nullable()->comment('meeting time passed (MG-11)');
            $table->timestamp('overdue_flagged_at')->nullable()->comment('no decision 7 days after the meeting (MG-16, FR36)');
            $table->timestamp('closed_at')->nullable()->comment('reached a final status (RQ-08)');
            $table->timestamps();

            // History: keep rows even if an account is removed (database guidelines §2).
            // The FKs above use restrict by default (no onDelete = restrict in Laravel).

            // Business rule: only one request per pet + human at a time (§5.5, SEC-AUTHZ-08).
            // Re-sends after a cooldown create a new row once the old one is closed.
            $table->unique(['pet_id', 'home_profile_id', 'status'], 'adoption_requests_pair_one_open_unique');
            $table->index('status'); // request lists and open-request counts
            $table->index(['pet_id', 'status']);
            $table->index(['home_profile_id', 'status']);
            $table->index('expires_at'); // 14-day expiry job
            $table->index('overdue_flagged_at'); // overdue follow-up job
            $table->index('sent_at'); // sorting by newest
        });

        // Slots a human offers for Meet & Greets (FR11, MG-01–02).
        Schema::create('meet_greet_slots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('home_profile_id')->constrained()->cascadeOnDelete()->comment('human who offers the slot (FR11)');
            $table->timestamp('starts_at')->comment('date and time (MG-02)');
            $table->enum('place_type', ['public_spot', 'shelter', 'caretaker_location'])->comment('section 5.4, MG-02');
            $table->string('place_details')->nullable()->comment('MG-02');
            $table->timestamp('deleted_at')->nullable()->comment('removed slot kept for past bookings (MG-01)');
            $table->timestamps();

            $table->index(['home_profile_id', 'starts_at']); // availability listing, ordered by time
            $table->index('deleted_at');
        });

        // One booking of a slot for a request; several rows per request over its life.
        Schema::create('meet_and_greets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('adoption_request_id')->constrained()->cascadeOnDelete();
            $table->foreignId('meet_greet_slot_id')->constrained()->cascadeOnDelete()->comment('slot booked by the pet (MG-03)');
            $table->enum('status', ['booked', 'confirmed', 'ended'])->comment('Meet and Greet status, see 5.4');
            $table->timestamp('booked_at')->nullable()->comment('pet booked the slot (MG-04)');
            $table->timestamp('confirmed_at')->nullable()->comment('human confirmed; contacts shared (MG-07, NFR4)');
            $table->timestamp('ended_at')->nullable()->comment('booking ended');
            $table->foreignId('ended_by_user_id')->nullable()->constrained('users')->nullOnDelete()->comment('who cancelled, rescheduled or reported it (MG-06, MG-09, MG-10, MG-13)');
            $table->enum('end_reason', [
                'schedule_conflict', 'pet_unwell', 'weather_or_travel', 'other',
                'didnt_show_pet_side', 'didnt_show_human_side', 'moved_to_another_day',
            ])->nullable()->comment('cancel reason (MG-10) or what happened (MG-13)');
            $table->text('end_details')->nullable()->comment('details, reschedule reason (MG-09) or proposal message (MG-06)');
            $table->foreignId('proposed_slot_id')->nullable()->constrained('meet_greet_slots')->nullOnDelete()->comment('slot the human proposed instead (MG-06)');
            $table->timestamps();

            // At most one active (booked or confirmed) booking per request; ended rows stay.
            $table->unique(['adoption_request_id', 'status'], 'meet_and_greets_one_active_per_request_unique');
            $table->index(['meet_greet_slot_id', 'status']); // double-booking check
            $table->index('confirmed_at'); // reminders 1 day and 1 hour before (§5.4)
        });

        // Message thread inside a request (RQ-11); sender null for system messages (RQ-11, MG-07).
        Schema::create('request_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('adoption_request_id')->constrained()->cascadeOnDelete();
            $table->foreignId('sender_user_id')->nullable()->constrained('users')->nullOnDelete()->comment('null for system messages (RQ-11, MG-07)');
            $table->text('body');
            $table->timestamps();

            $table->index(['adoption_request_id', 'created_at']); // thread, oldest first
        });

        // The adoption link: exactly one active Furparent per pet (§5.5, FR13, AL-04).
        Schema::create('adoptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pet_id')->constrained()->cascadeOnDelete()->comment('exactly one active Furparent per pet (section 5.5)');
            $table->foreignId('home_profile_id')->constrained()->cascadeOnDelete()->comment('the Furparent (FR13)');
            $table->foreignId('adoption_request_id')->unique()->constrained()->cascadeOnDelete()->comment('the Adopted request record (AL-04)');
            $table->timestamp('adopted_at')->comment('Adopt confirmed (AL-01, FR12)');
            $table->timestamp('link_removed_at')->nullable()->comment('adoption cancelled by an admin (AL-07, AL-08)');
            $table->timestamps();

            // Exactly one active link per pet; a removed link (link_removed_at set)
            // is kept for history and allows a new adoption row.
            $table->unique(['pet_id', 'link_removed_at'], 'adoptions_one_active_per_pet_unique');
            $table->index('home_profile_id');
        });

        // Admin's manual status fix — the only manual status change (FR37, AL-07, NFR9).
        Schema::create('adoption_resolutions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('admin_user_id')->constrained('users')->cascadeOnDelete()->comment('FR37');
            $table->foreignId('pet_id')->constrained()->cascadeOnDelete()->comment('AL-07');
            $table->foreignId('adoption_request_id')->nullable()->constrained()->nullOnDelete()->comment('related request (AL-07)');
            $table->enum('action', [
                'cancel_adoption', 'return_to_looking_for_a_home', 'close_request', 'reopen_meet_greet_booking',
            ])->comment('resolution action (AL-07)');
            $table->text('reason')->comment('required (FR37, NFR9)');
            $table->timestamps();

            $table->index(['pet_id', 'created_at']); // recent resolutions list (AL-07)
            $table->index('admin_user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('adoption_resolutions');
        Schema::dropIfExists('adoptions');
        Schema::dropIfExists('request_messages');
        Schema::dropIfExists('meet_and_greets');
        Schema::dropIfExists('meet_greet_slots');
        Schema::dropIfExists('adoption_requests');
    }
};
