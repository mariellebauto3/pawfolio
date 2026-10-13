<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const INDEXES = [
        'pet_photos_path_reference_index' => ['pet_photos', 'file_path'],
        'post_photos_path_reference_index' => ['post_photos', 'file_path'],
        'pets_cover_path_reference_index' => ['pets', 'cover_photo_path'],
        'home_avatar_path_reference_index' => ['home_profiles', 'profile_photo_path'],
        'home_cover_path_reference_index' => ['home_profiles', 'cover_photo_path'],
        'verification_documents_path_reference_index' => ['verification_documents', 'file_path'],
        'pet_vet_records_path_reference_index' => ['pet_vet_records', 'file_path'],
    ];

    public function up(): void
    {
        foreach (self::INDEXES as $name => [$table, $column]) {
            DB::statement("CREATE INDEX {$name} ON {$table}({$column}) WHERE {$column} IS NOT NULL");
        }
    }

    public function down(): void
    {
        foreach (array_keys(self::INDEXES) as $name) {
            DB::statement("DROP INDEX {$name}");
        }
    }
};
