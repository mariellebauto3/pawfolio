<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Keep stored addresses and the existing unique constraint intact. Stop on
        // ambiguous legacy accounts rather than merging or deleting user data.
        DB::statement('CREATE UNIQUE INDEX users_email_lower_unique ON users (LOWER(email))');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX users_email_lower_unique');
    }
};
