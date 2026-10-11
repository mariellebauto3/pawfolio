<?php

namespace App\Models;

use App\Enums\IdType;
use App\Enums\VerificationDocumentType;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VerificationDocument extends Model
{
    use HasFactory;

    protected $table = 'verification_documents';

    protected $fillable = [
        'document_type',
        'id_type',
        'file_path',
        'mime_type',
        'size_bytes',
    ];

    protected $casts = [
        'id' => 'integer',
        'verification_submission_id' => 'integer',
        'size_bytes' => 'integer',
    ];

    public function submission(): BelongsTo
    {
        return $this->belongsTo(VerificationSubmission::class, 'verification_submission_id');
    }

    public function documentType(): VerificationDocumentType
    {
        return VerificationDocumentType::tryFrom((string) $this->document_type) ?: VerificationDocumentType::ValidId;
    }

    public function idType(): ?IdType
    {
        return $this->id_type !== null ? IdType::tryFrom((string) $this->id_type) : null;
    }
}
