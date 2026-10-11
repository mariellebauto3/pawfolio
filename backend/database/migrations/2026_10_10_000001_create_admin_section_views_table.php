<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * When each admin last opened a section of the admin sidebar that carries a count (Verification, Reports, Requests
 * & Meets). The sidebar counts only what arrived after it, so a count clears once the section has been looked at.
 * One row per admin and section; no row means the admin never opened it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('admin_section_views', function (Blueprint $table): void {
            $table->id();
            // Owned by the admin's account and of no use without it.
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('section', 32);
            $table->timestamp('seen_at');
            $table->timestamps();

            $table->unique(['user_id', 'section']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('admin_section_views');
    }
};
