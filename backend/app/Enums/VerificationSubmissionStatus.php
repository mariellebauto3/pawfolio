<?php

namespace App\Enums;

/**
 * Status of one verification round (sign-up or resubmission).
 * Matches verification_submissions.status (AU-22–26, FR33).
 */
enum VerificationSubmissionStatus: string
{
    case Pending = 'pending';
    case Approved = 'approved';
    case Denied = 'denied';
}
