<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * users — one account per Pet, Human or Admin (ERD §3, proposal §2).
 *
 * Columns added here per the Pawfolio ERD:
 * - role: pet, human or admin (section 2).
 * - status: account status, see proposal §5.1 — system-set only (FR27, NFR3).
 * - name (scaffolded column, made nullable here): admin display name only,
 *   e.g. admin.jess (LG-03); pet and human names live in pets / home_profiles.
 * - terms_accepted_at: nullable for admins, Terms checkbox (AU-12, AU-17).
 *
 * The existing email/password/remember_token columns cover the ERD's sign-in
 * columns (one sign-in page for all roles, AU-02).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->enum('role', ['pet', 'human', 'admin'])->after('id');
            $table->enum('status', ['pending_verification', 'active', 'denied', 'suspended', 'deactivated'])
                ->default('pending_verification')->after('role');
            $table->timestamp('terms_accepted_at')->nullable()->after('password');

            // Admin verification queue and account administration filter by account status (AU-22, AC-06).
            // ERD: name is "nullable, admin display name only" — pet and human
            // display names live in pets.name and home_profiles.full_name.
            $table->string('name')->nullable()->change();

            $table->index('status');
            $table->index(['role', 'status']);
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['role', 'status']);
            $table->dropIndex(['status']);
            $table->dropColumn(['role', 'status', 'terms_accepted_at']);
            $table->string('name')->change(); // restore the scaffold's NOT NULL
        });
    }
};
