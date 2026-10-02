<?php

namespace App\Enums;

/**
 * File type uploaded with a verification submission.
 * Matches verification_documents.document_type (AU-10, AU-16).
 */
enum VerificationDocumentType: string
{
    case ValidId = 'valid_id';
    case PetPhoto = 'pet_photo';
    case VetRecordOrCertificate = 'vet_record_or_certificate';
}
