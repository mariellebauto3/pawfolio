<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('CREATE INDEX posts_visible_created_id_index ON posts(created_at DESC, id DESC) WHERE deleted_at IS NULL AND removed_at IS NULL');
        DB::statement('CREATE INDEX comments_visible_thread_index ON comments(post_id, parent_comment_id, created_at) WHERE removed_at IS NULL');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX comments_visible_thread_index');
        DB::statement('DROP INDEX posts_visible_created_id_index');
    }
};
