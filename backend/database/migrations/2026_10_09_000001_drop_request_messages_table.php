<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The request thread is not built: the proposal keeps messaging between a pet and a human as future
     * scope (§10), and the two sides reach each other through the Meet & Greet (decided 2026-10-09).
     */
    public function up(): void
    {
        Schema::dropIfExists('request_messages');
    }

    public function down(): void
    {
        Schema::create('request_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('adoption_request_id')->constrained()->restrictOnDelete();
            $table->foreignId('sender_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('body');
            $table->timestamps();

            $table->index(['adoption_request_id', 'created_at']);
            $table->index('sender_user_id');
        });
    }
};
