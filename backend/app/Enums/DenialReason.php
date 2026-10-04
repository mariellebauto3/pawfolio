<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * Reason for denying a verification submission (AU-25).
 * Matches verification_submissions.denial_reason.
 */
enum DenialReason: string
{
    case IdPhotoUnreadable = 'id_photo_unreadable';
    case NameMismatch = 'name_mismatch';
    case IdExpired = 'id_expired';
    case Under18 = 'under_18';
    case Other = 'other';
}
