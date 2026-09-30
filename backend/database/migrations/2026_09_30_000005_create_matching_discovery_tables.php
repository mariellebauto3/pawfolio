<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Matching, discovery, bookmarks and invites (ERD page 6). Matching follows
 * proposal §6: pairs that hit a dealbreaker (species not accepted, pet not good
 * with kids or pets in the home, different province) are excluded and get no
 * row. Eligible pairs store the total and the 7 weighted criterion points shown
 * on the Match breakdown dialog (MT-03). Scores are recalculated whenever a
 * quiz or résumé changes (§6, PR-20).
 */
return new class extends Migration
{
    public function up(): void
    {
        // Invite to Apply: a human nudges a pet to send a request (FR9, RQ-01).
        Schema::create('invites', function (Blueprint $table) {
            $table->id();
            $table->foreignId('home_profile_id')->constrained()->cascadeOnDelete()->comment('human who invites (FR9)');
            $table->foreignId('pet_id')->constrained()->cascadeOnDelete()->comment('pet invited to apply');
            $table->text('note')->nullable()->comment('personal note (RQ-01)');
            $table->timestamp('dismissed_at')->nullable()->comment('pet dismissed it (RQ-02)');
            $table->timestamps();

            // One live invite per pet + human pair (dismissed invites allow
            // re-invites) is checked in the Invite Action (SEC-AUTHZ-08). No
            // unique key: dismissed_at is null on the live row, and nulls are
            // never equal, so it could not guard anything.
            $table->index(['home_profile_id', 'pet_id']); // live-invite check
            $table->index('pet_id');
        });

        // Weighted match score per eligible pet ↔ home pair (MT-02, MT-03, §6).
        Schema::create('match_scores', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pet_id')->constrained()->cascadeOnDelete();
            $table->foreignId('home_profile_id')->constrained()->cascadeOnDelete();
            $table->smallInteger('score')->comment('0 to 100, same score both directions (MT-02)');
            $table->smallInteger('activity_points')->nullable()->comment('of 20, activity vs energy');
            $table->smallInteger('hours_away_points')->nullable()->comment('of 15, hours away vs time alone');
            $table->smallInteger('space_points')->nullable()->comment('of 15, home and outdoor vs space needs');
            $table->smallInteger('experience_points')->nullable()->comment('of 15, experience vs experience needed');
            $table->smallInteger('size_age_points')->nullable()->comment('of 15, preferred size and age');
            $table->smallInteger('compatibility_points')->nullable()->comment('of 10, kids and other pets');
            $table->smallInteger('special_needs_points')->nullable()->comment('of 10, special needs vs medical care');
            $table->timestamp('calculated_at')->nullable()->comment('recalculated on quiz or resume change (PR-20)');
            $table->timestamps();

            $table->unique(['pet_id', 'home_profile_id']); // one score per pair
            $table->index(['home_profile_id', 'score']); // Pets for You list, sorted by score
            $table->index(['pet_id', 'score']); // Homes for You list, sorted by score
        });

        // Bookmarks, polymorphic in effect: a human saves a pet, or a pet saves a home (FR8, FR23).
        Schema::create('bookmarks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete()->comment('who saved it');
            $table->foreignId('pet_id')->nullable()->constrained()->cascadeOnDelete()->comment('set when a human saves a pet (FR8)');
            $table->foreignId('home_profile_id')->nullable()->constrained()->cascadeOnDelete()->comment('set when a pet saves a home (FR23)');
            $table->timestamps();

            // One bookmark per saver and target; check exactly one target set in the model layer.
            // (Nulls-are-distinct is the right tool here: each unique fires only
            // when that target column is set.) The two indexes below cover the
            // FK columns, which Postgres does not index automatically.
            $table->unique(['user_id', 'pet_id']);
            $table->unique(['user_id', 'home_profile_id']);
            $table->index('pet_id'); // who saved this pet
            $table->index('home_profile_id'); // a pet's saved homes (FR23)
        });

        // Résumé and Home Profile view counts for analytics (AN-01).
        Schema::create('profile_views', function (Blueprint $table) {
            $table->id();
            $table->foreignId('viewer_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('pet_id')->nullable()->constrained()->cascadeOnDelete()->comment('a resume was viewed (AN-01)');
            $table->foreignId('home_profile_id')->nullable()->constrained()->cascadeOnDelete()->comment('a Home Profile was viewed (PR-11)');
            $table->enum('source', ['browse', 'search', 'matches', 'bookmarks', 'feed', 'direct'])->nullable()->comment('where the view came from (AN-01)');
            $table->timestamps();

            $table->index(['pet_id', 'created_at']); // views chart per day (AN-01)
            $table->index(['home_profile_id', 'created_at']);
            $table->index('viewer_user_id'); // FK; a viewer's view history
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('profile_views');
        Schema::dropIfExists('bookmarks');
        Schema::dropIfExists('match_scores');
        Schema::dropIfExists('invites');
    }
};
