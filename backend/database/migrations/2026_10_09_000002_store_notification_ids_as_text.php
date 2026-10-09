<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Notification ids are ULIDs (the model's HasUlids), and the column was created as `uuid`.
 *
 * SQLite keeps a uuid as text, so nothing showed locally. PostgreSQL, the production engine, checks the format and
 * refuses a ULID ("invalid input syntax for type uuid"): no notification could be written there, and an action
 * that notifies inside its transaction (approving an account, sending an invite) failed with it. A plain string
 * column holds the same ids on every engine.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            // 36 characters, so an id written as a UUID before this still fits.
            $table->string('id', 36)->change();
        });
    }

    public function down(): void
    {
        // Left as text: ULIDs written since can't be turned back into the uuid type.
    }
};
