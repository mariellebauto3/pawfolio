<?php

namespace Database\Factories;

use App\Enums\IdType;
use App\Enums\VerificationDocumentType;
use App\Models\VerificationDocument;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<VerificationDocument>
 */
class VerificationDocumentFactory extends Factory
{
    protected $model = VerificationDocument::class;

    public function definition(): array
    {
        return [
            'verification_submission_id' => VerificationSubmissionFactory::new()->sequence(fn (array $attrs) => $attrs['verification_submission_id'] ?? null),
            'document_type' => VerificationDocumentType::ValidId->value,
            'id_type' => IdType::DriversLicense->value,
            'file_path' => 'documents/' . bin2hex(fake()->hexify(16)) . '.' . fake()->randomElement(['jpg', 'png', 'pdf']),
            'mime_type' => 'image/jpeg',
            'size_bytes' => fake()->numberBetween(1024, 5 * 1024 * 1024),
        ];
    }

    public function petPhoto(): static
    {
        return $this->state(fn (array $attrs) => [
            'document_type' => VerificationDocumentType::PetPhoto->value,
            'mime_type' => 'image/jpeg',
        ]);
    }

    public function vetRecord(): static
    {
        return $this->state(fn (array $attrs) => [
            'document_type' => VerificationDocumentType::VetRecordOrCertificate->value,
            'mime_type' => 'application/pdf',
        ]);
    }
}
