<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Pet résumé (ERD page 4): one pet account = one pet (§1, AU-07). The verified
 * sign-up fields (name, species, breed, approximate age) are locked after
 * approval (AU-09, PR-03). The rest of the résumé is filled in through the
 * 6-step editor (PR-03–PR-08). Until the résumé is published, the pet is draft
 * and hidden from search and matches (§5.2, PR-02).
 *
 * Enum values follow the LoFi editor options (PR-03–PR-08).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete()->comment('account with role pet');
            $table->string('name')->comment('locked after approval (AU-09, PR-03)');
            $table->enum('species', ['dog', 'cat', 'other'])->comment('locked (AU-09)');
            $table->string('breed')->comment('locked (AU-09)');
            $table->integer('approximate_age_months')->comment('locked; see open question Q5 (AU-09)');
            $table->enum('sex', ['female', 'male'])->nullable()->comment('until the résumé is edited (PR-03)');
            $table->enum('size', ['small', 'medium', 'large'])->nullable()->comment('until the résumé is edited (PR-03, FR6)');
            $table->string('currently_at')->comment('where the pet is staying (AU-09, PR-03)');
            $table->string('city')->comment('AU-09, PR-03');
            $table->string('province')->comment('AU-09, PR-03, same-province matching');
            $table->string('caretaker_name')->comment('AU-11, AC-01');
            $table->string('caretaker_contact_number')->comment('private (AU-11, NFR4)');
            $table->text('bio')->nullable()->comment('first person, 50 to 600 chars (PR-05)');
            $table->enum('energy_level', ['low', 'medium', 'high'])->nullable()->comment('PR-05, 20 match points');
            $table->enum('good_with_kids', ['yes', 'no', 'unknown'])->nullable()->comment('until PR-06');
            $table->enum('good_with_dogs', ['yes', 'no', 'unknown'])->nullable()->comment('until PR-06');
            $table->enum('good_with_cats', ['yes', 'no', 'unknown'])->nullable()->comment('until PR-06');
            $table->enum('time_alone', ['up_to_2_hrs', 'up_to_4_hrs', 'up_to_6_hrs', '8_plus_hrs'])->nullable()->comment('can be left alone (PR-06)');
            $table->enum('space_needs', ['apartment_ok', 'needs_yard_or_daily_walks', 'ground_floor'])->nullable()->comment('PR-06');
            $table->enum('experience_needed', ['first_time_ok', 'some_experience', 'experienced_only'])->nullable()->comment('owner experience needed (PR-06)');
            $table->text('health_notes')->nullable()->comment('health and vet notes (PR-07)');
            $table->string('cover_photo_path')->nullable()->comment('PR-04');
            $table->enum('status', ['draft', 'looking_for_a_home', 'in_process', 'adopted_hired'])
                ->default('draft')->comment('pet adoption status, system-set only (section 5.2, FR27)');
            $table->timestamp('published_at')->nullable()->comment('first Draft to Looking for a Home (PR-10)');
            $table->timestamps();

            // Browse & search filters (DS-01): species, age group, size, city, province; feed filtering by status.
            $table->index('status');
            $table->index(['status', 'published_at']);
            $table->index('species');
            $table->index('size');
            $table->index('city');
            $table->index('province');
            $table->index('approximate_age_months');
            $table->index('energy_level');
        });

        // Gallery photos; first photo (lowest sort_order) is the profile photo (PR-04).
        // Owned child rows: cascade when the pet is removed (database guidelines §2).
        Schema::create('pet_photos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pet_id')->constrained()->cascadeOnDelete();
            $table->string('file_path')->comment('compressed on upload (PR-09, NFR7)');
            $table->string('caption')->nullable()->comment('PR-09');
            $table->integer('sort_order')->comment('first photo is the profile photo (PR-04)');
            $table->timestamps();

            $table->index(['pet_id', 'sort_order']);
        });

        // Free-style temperament tags, up to 5 per pet (PR-05).
        Schema::create('pet_temperament_tags', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pet_id')->constrained()->cascadeOnDelete();
            $table->string('tag')->comment('up to 5 per pet (PR-05)');
            $table->timestamps();

            $table->index(['pet_id', 'tag']); // temperament filter (DS-01)
        });

        // Trained behaviours (PR-06).
        Schema::create('pet_skills', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pet_id')->constrained()->cascadeOnDelete();
            $table->enum('skill', [
                'sit_and_stay', 'leash_trained', 'potty_trained', 'crate_trained',
                'litter_trained', 'comes_when_called', 'learning_sit', 'potty_training_in_progress',
                'scratching_post_only', 'quiet_at_night', 'house_trained', 'sit', 'shake',
            ])->comment('trained behaviour (PR-06)');
            $table->timestamps();

            $table->index(['pet_id', 'skill']);
        });

        // Special needs / ongoing medical care; no rows means None (PR-07).
        Schema::create('pet_special_needs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pet_id')->constrained()->cascadeOnDelete();
            $table->enum('need', ['daily_meds', 'special_diet', 'mobility_support'])->comment('no rows means None (PR-07)');
            $table->timestamps();

            $table->index('pet_id');
        });

        // Vet records and shelter certificates; stored as private-disk paths only.
        // Humans see them only after a request is approved (PR-07, SEC-PRIV-01).
        Schema::create('pet_vet_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pet_id')->constrained()->cascadeOnDelete();
            $table->string('file_path')->comment('private; humans see it only after a request is approved (PR-07)');
            $table->string('mime_type');
            $table->integer('size_bytes');
            $table->timestamps();

            $table->index('pet_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pet_vet_records');
        Schema::dropIfExists('pet_special_needs');
        Schema::dropIfExists('pet_skills');
        Schema::dropIfExists('pet_temperament_tags');
        Schema::dropIfExists('pet_photos');
        Schema::dropIfExists('pets');
    }
};
