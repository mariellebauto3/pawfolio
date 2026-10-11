<?php

namespace Database\Factories;

use App\Enums\IdType;
use App\Enums\VerificationDocumentType;
use App\Models\VerificationDocument;
use App\Models\VerificationSubmission;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<VerificationDocument>
 */
class VerificationDocumentFactory extends Factory
{
    protected $model = VerificationDocument::class;

    public function definition(): array
    {
        return [
            'verification_submission_id' => VerificationSubmission::factory(),
            'document_type' => VerificationDocumentType::ValidId->value,
            'id_type' => IdType::DriversLicense->value,
            'file_path' => 'verification/'.Str::uuid()->toString().'.jpg',
            'mime_type' => 'image/jpeg',
            'size_bytes' => fake()->numberBetween(1024, 5 * 1024 * 1024),
        ];
    }

    public function petPhoto(): static
    {
        return $this->state(fn () => [
            'document_type' => VerificationDocumentType::PetPhoto->value,
            'id_type' => null,
            'mime_type' => 'image/jpeg',
        ]);
    }

    public function vetRecord(): static
    {
        return $this->state(fn () => [
            'document_type' => VerificationDocumentType::VetRecordOrCertificate->value,
            'id_type' => null,
            'file_path' => 'verification/'.Str::uuid()->toString().'.pdf',
            'mime_type' => 'application/pdf',
        ]);
    }
}
