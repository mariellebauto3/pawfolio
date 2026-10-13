<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const TABLES = ['users', 'pets', 'adoption_requests', 'meet_and_greets', 'meet_greet_slots', 'adoptions', 'reports'];

    public function up(): void
    {
        DB::statement('CREATE INDEX posts_visible_author_cursor_index ON posts(author_user_id, created_at DESC, id DESC) WHERE deleted_at IS NULL AND removed_at IS NULL');
        DB::statement('CREATE INDEX posts_visible_type_cursor_index ON posts(type, created_at DESC, id DESC) WHERE deleted_at IS NULL AND removed_at IS NULL');
        DB::table('read_cache_versions')->insert(['name' => 'admin-dashboard', 'version' => 1]);

        if (DB::getDriverName() === 'pgsql') {
            DB::unprepared("CREATE FUNCTION pawfolio_invalidate_dashboard_metrics() RETURNS trigger LANGUAGE plpgsql AS $$
                BEGIN
                    UPDATE read_cache_versions SET version = version + 1 WHERE name = 'admin-dashboard';
                    RETURN NULL;
                END;
            $$");
            foreach (self::TABLES as $table) {
                $update = match ($table) {
                    'users' => 'UPDATE OF role, status',
                    'pets' => 'UPDATE OF status',
                    default => 'UPDATE',
                };
                DB::unprepared("CREATE TRIGGER {$table}_dashboard_metrics_version AFTER INSERT OR $update OR DELETE OR TRUNCATE ON $table FOR EACH STATEMENT EXECUTE FUNCTION pawfolio_invalidate_dashboard_metrics()");
            }
        } elseif (DB::getDriverName() === 'sqlite') {
            foreach (self::TABLES as $table) {
                foreach (['INSERT', 'UPDATE', 'DELETE'] as $event) {
                    DB::unprepared("CREATE TRIGGER {$table}_dashboard_metrics_{$event} AFTER $event ON $table BEGIN UPDATE read_cache_versions SET version = version + 1 WHERE name = 'admin-dashboard'; END");
                }
            }
        }
    }

    public function down(): void
    {
        foreach (self::TABLES as $table) {
            if (DB::getDriverName() === 'pgsql') {
                DB::unprepared("DROP TRIGGER IF EXISTS {$table}_dashboard_metrics_version ON $table");
            } elseif (DB::getDriverName() === 'sqlite') {
                foreach (['INSERT', 'UPDATE', 'DELETE'] as $event) {
                    DB::unprepared("DROP TRIGGER IF EXISTS {$table}_dashboard_metrics_{$event}");
                }
            }
        }
        if (DB::getDriverName() === 'pgsql') {
            DB::unprepared('DROP FUNCTION IF EXISTS pawfolio_invalidate_dashboard_metrics()');
        }
        DB::table('read_cache_versions')->where('name', 'admin-dashboard')->delete();
        DB::statement('DROP INDEX posts_visible_author_cursor_index');
        DB::statement('DROP INDEX posts_visible_type_cursor_index');
    }
};
