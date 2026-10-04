<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Widen personal contact and street address columns so Laravel's encrypted
     * cast ciphertext fits comfortably across SQLite, MySQL, and PostgreSQL (SEC-PRIV-05).
     */
    public function up(): void
    {
        Schema::table('pets', function (Blueprint $table) {
            $table->text('caretaker_contact_number')->nullable()->change();
        });

        Schema::table('home_profiles', function (Blueprint $table) {
            $table->text('contact_number')->nullable()->change();
            $table->text('street_address')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('pets', function (Blueprint $table) {
            $table->string('caretaker_contact_number', 30)->nullable()->change();
        });

        Schema::table('home_profiles', function (Blueprint $table) {
            $table->string('contact_number', 30)->nullable()->change();
            $table->string('street_address')->nullable()->change();
        });
    }
};
