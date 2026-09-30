<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Home Profile and lifestyle quiz (ERD page 5): a human's home_profiles row is
 * created at sign-up with the verified identity and private contact details
 * (AU-14, AU-15). The Home Profile and quiz columns stay empty until the 6-step
 * quiz is saved (PR-14–PR-19). Multi-choice quiz answers live in child tables,
 * one row per selected option.
 *
 * Enum values follow the LoFi quiz options (PR-14–PR-18).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('home_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete()->comment('account with role human');
            $table->string('full_name')->comment('locked, display name (AU-14, PR-12)');
            $table->date('birthdate')->comment('locked, must be 18 or older (AU-14, section 5.1)');
            $table->string('contact_number')->comment('private until a Meet and Greet is confirmed (AU-14, NFR4)');
            $table->string('city')->comment('public (AU-15, PR-12)');
            $table->string('province')->comment('same-province matching (AU-15)');
            $table->string('street_address')->comment('private until a Meet and Greet is confirmed (AU-15, NFR4)');
            $table->string('headline')->nullable()->comment('PR-12');
            $table->text('about_home')->nullable()->comment('shown publicly (PR-12, PR-14)');
            $table->string('profile_photo_path')->nullable()->comment('PR-12');
            $table->string('cover_photo_path')->nullable()->comment('PR-12');
            $table->enum('home_type', ['house', 'condo', 'apartment', 'townhouse'])->nullable()->comment('until quiz (PR-15)');
            $table->enum('outdoor_space', ['none', 'balcony', 'small_yard', 'large_yard'])->nullable()->comment('until quiz (PR-15)');
            $table->enum('activity_level', ['relaxed', 'moderate', 'active', 'very_active'])->nullable()->comment('until quiz, 20 match points (PR-16)');
            $table->enum('hours_away', ['0_to_2', '3_to_5', '6_to_8', '9_plus'])->nullable()->comment('until quiz, 15 match points (PR-16)');
            $table->enum('pet_experience', ['first_time', 'some', 'experienced'])->nullable()->comment('until quiz (PR-17)');
            $table->enum('special_needs_willingness', ['yes', 'minor_needs_only', 'no'])->nullable()->comment('until quiz (PR-17)');
            $table->boolean('is_open_to_adopt')->default(false)->comment('Open to Adopt toggle (FR4, PR-13, PR-20)');
            $table->timestamp('quiz_completed_at')->nullable()->comment('Pets for You unlocks (MT-04)');
            $table->timestamp('furparent_at')->nullable()->comment('Furparent label; stays after a link is removed (FR13, AL-08)');
            $table->timestamps();

            $table->index('province'); // same-province dealbreaker (§6)
            $table->index('city');
            $table->index('is_open_to_adopt'); // requests only while Open to Adopt (§5.5)
            $table->index('activity_level');
            $table->index('hours_away');
        });

        // Multi-choice quiz answers: one row per selected option.

        // Who lives with you (PR-14) — kids drive the good_with_kids dealbreaker.
        Schema::create('home_profile_household_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('home_profile_id')->constrained()->cascadeOnDelete();
            $table->enum('member', ['just_me', 'partner', 'kids_under_6', 'kids_6_to_12', 'teens', 'seniors']);
            $table->timestamps();

            $table->index('home_profile_id');
        });

        // Other pets at home (PR-14) — no rows means None; drives the good_with_dogs/cats dealbreaker.
        Schema::create('home_profile_other_pets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('home_profile_id')->constrained()->cascadeOnDelete();
            $table->enum('pet_type', ['dogs', 'cats', 'other'])->comment('no rows means None (PR-14)');
            $table->timestamps();

            $table->index('home_profile_id');
        });

        // Species accepted (PR-18) — a species not accepted is a dealbreaker (§6).
        Schema::create('home_profile_accepted_species', function (Blueprint $table) {
            $table->id();
            $table->foreignId('home_profile_id')->constrained()->cascadeOnDelete();
            $table->enum('species', ['dog', 'cat', 'other'])->comment('dealbreaker if not accepted (PR-18, section 6)');
            $table->timestamps();

            $table->unique(['home_profile_id', 'species']);
        });

        // Preferred size (PR-18) — part of the size & age criterion (15 points).
        Schema::create('home_profile_preferred_sizes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('home_profile_id')->constrained()->cascadeOnDelete();
            $table->enum('size', ['small', 'medium', 'large'])->comment('PR-18');
            $table->timestamps();

            $table->unique(['home_profile_id', 'size']);
        });

        // Preferred age group (PR-18) — part of the size & age criterion (15 points).
        Schema::create('home_profile_preferred_ages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('home_profile_id')->constrained()->cascadeOnDelete();
            $table->enum('age_group', ['puppy_kitten', 'adult', 'senior'])->comment('PR-18');
            $table->timestamps();

            $table->unique(['home_profile_id', 'age_group']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('home_profile_preferred_ages');
        Schema::dropIfExists('home_profile_preferred_sizes');
        Schema::dropIfExists('home_profile_accepted_species');
        Schema::dropIfExists('home_profile_other_pets');
        Schema::dropIfExists('home_profile_household_members');
        Schema::dropIfExists('home_profiles');
    }
};
