<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Partial constraints allow unlimited ended/deleted history while
        // enforcing the existing scheduling rules under simultaneous writes.
        DB::statement('CREATE UNIQUE INDEX slots_home_time_active_unique ON meet_greet_slots(home_profile_id, starts_at) WHERE deleted_at IS NULL');
        DB::statement("CREATE UNIQUE INDEX meetings_request_active_unique ON meet_and_greets(adoption_request_id) WHERE status IN ('booked', 'confirmed')");
        DB::statement("CREATE UNIQUE INDEX meetings_slot_active_unique ON meet_and_greets(meet_greet_slot_id) WHERE status IN ('booked', 'confirmed')");
    }

    public function down(): void
    {
        DB::statement('DROP INDEX meetings_slot_active_unique');
        DB::statement('DROP INDEX meetings_request_active_unique');
        DB::statement('DROP INDEX slots_home_time_active_unique');
    }
};
