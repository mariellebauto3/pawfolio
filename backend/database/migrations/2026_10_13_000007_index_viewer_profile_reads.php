<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('profile_views', function (Blueprint $table) {
            // Profile opens check whether this viewer already visited today.
            $table->index(['viewer_user_id', 'pet_id', 'created_at'], 'profile_views_viewer_pet_time');
            $table->index(['viewer_user_id', 'home_profile_id', 'created_at'], 'profile_views_viewer_home_time');
        });
    }

    public function down(): void
    {
        Schema::table('profile_views', function (Blueprint $table) {
            $table->dropIndex('profile_views_viewer_pet_time');
            $table->dropIndex('profile_views_viewer_home_time');
        });
    }
};
