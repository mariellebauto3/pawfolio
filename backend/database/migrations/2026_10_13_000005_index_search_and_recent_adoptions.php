<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const SEARCH_COLUMNS = [
        'pets' => ['name', 'caretaker_name', 'breed', 'city', 'bio'],
        'home_profiles' => ['full_name', 'headline', 'city', 'about_home'],
        'posts' => ['title', 'body'],
        'users' => ['name', 'email'],
    ];

    public function up(): void
    {
        Schema::table('adoptions', function (Blueprint $table) {
            $table->index(['link_removed_at', 'adopted_at', 'id'], 'adoptions_recent_hired_index');
        });

        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        // B-tree indexes cannot accelerate contains matching. Trigrams preserve LIKE semantics.
        // Very short terms may still scan; bounded suggestion queries avoid full counts and resources.
        DB::statement('CREATE EXTENSION IF NOT EXISTS pg_trgm');
        foreach (self::SEARCH_COLUMNS as $table => $columns) {
            foreach ($columns as $column) {
                DB::statement("CREATE INDEX {$table}_{$column}_search_trgm ON {$table} USING gin (LOWER({$column}) gin_trgm_ops)");
            }
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            foreach (self::SEARCH_COLUMNS as $table => $columns) {
                foreach ($columns as $column) {
                    DB::statement("DROP INDEX {$table}_{$column}_search_trgm");
                }
            }
        }
        Schema::table('adoptions', function (Blueprint $table) {
            $table->dropIndex('adoptions_recent_hired_index');
        });
    }
};
