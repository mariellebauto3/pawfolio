<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const TABLES = ['adoptions', 'pets', 'users', 'pet_photos'];

    public function up(): void
    {
        Schema::create('read_cache_versions', function (Blueprint $table) {
            $table->string('name')->primary();
            $table->bigInteger('version')->default(1);
        });
        DB::table('read_cache_versions')->insert(['name' => 'recently-hired', 'version' => 1]);

        if (DB::getDriverName() === 'pgsql') {
            DB::unprepared("CREATE FUNCTION pawfolio_invalidate_recently_hired() RETURNS trigger LANGUAGE plpgsql AS $$
                BEGIN
                    UPDATE read_cache_versions SET version = version + 1 WHERE name = 'recently-hired';
                    RETURN NULL;
                END;
            $$");
            foreach (self::TABLES as $table) {
                // Statement triggers cover bulk writes and cascades, without per-row overhead.
                $columns = match ($table) {
                    'users' => 'status',
                    'pets' => 'name, status, user_id',
                    default => null,
                };
                $update = $columns ? "UPDATE OF $columns" : 'UPDATE';
                DB::unprepared("CREATE TRIGGER {$table}_recently_hired_version AFTER INSERT OR $update OR DELETE OR TRUNCATE ON $table FOR EACH STATEMENT EXECUTE FUNCTION pawfolio_invalidate_recently_hired()");
            }
        } elseif (DB::getDriverName() === 'sqlite') {
            foreach (self::TABLES as $table) {
                foreach (['INSERT', 'UPDATE', 'DELETE'] as $event) {
                    DB::unprepared("CREATE TRIGGER {$table}_recently_hired_{$event} AFTER $event ON $table BEGIN UPDATE read_cache_versions SET version = version + 1 WHERE name = 'recently-hired'; END");
                }
            }
        }
    }

    public function down(): void
    {
        foreach (self::TABLES as $table) {
            if (DB::getDriverName() === 'pgsql') {
                DB::unprepared("DROP TRIGGER IF EXISTS {$table}_recently_hired_version ON $table");
            } elseif (DB::getDriverName() === 'sqlite') {
                foreach (['INSERT', 'UPDATE', 'DELETE'] as $event) {
                    DB::unprepared("DROP TRIGGER IF EXISTS {$table}_recently_hired_{$event}");
                }
            }
        }
        if (DB::getDriverName() === 'pgsql') {
            DB::unprepared('DROP FUNCTION IF EXISTS pawfolio_invalidate_recently_hired()');
        }
        Schema::dropIfExists('read_cache_versions');
    }
};
