<?php

use App\Enums\NotificationCategory;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The tab a notification is listed under (NT-02, NT-03), as a column of its own.
 *
 * The tabs used to filter on `data->category`. `data` is a text column, and a JSON path on text is an error in
 * PostgreSQL, the production engine: every tab but All answered 500 there. A plain, indexed column filters the
 * same way on every engine (database guidelines: no JSON operators).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->string('category', 32)->nullable()->after('type')->comment('NT-02 tab; null lists under All only');
            $table->index(['user_id', 'category', 'created_at']);
        });

        // Rows written before the column existed: the category their sender put in `data`, or their type's own.
        DB::table('notifications')->select(['id', 'type', 'data'])->orderBy('id')->chunk(500, function ($rows): void {
            foreach ($rows as $row) {
                $data = json_decode((string) $row->data, true);
                $category = NotificationCategory::of((string) $row->type, is_array($data) ? ($data['category'] ?? null) : null);

                if ($category !== null) {
                    DB::table('notifications')->where('id', $row->id)->update(['category' => $category->value]);
                }
            }
        });
    }

    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropIndex(['user_id', 'category', 'created_at']);
            $table->dropColumn('category');
        });
    }
};
