<?php

declare(strict_types=1);

namespace App\Exceptions;

use App\Models\VerificationSubmission;
use RuntimeException;

/**
 * An admin tried to approve or deny a submission that isn't waiting for a decision any more: another admin decided
 * first, or the account left Pending Verification. The API answers 409 `verification_already_reviewed`.
 */
class VerificationAlreadyReviewed extends RuntimeException
{
    public const CODE = 'verification_already_reviewed';

    public static function decided(VerificationSubmission $submission): self
    {
        $by = $submission->reviewedBy?->displayName() ?: 'another admin';

        return new self("This account was already {$submission->status} by {$by}.");
    }

    public static function noLongerWaiting(): self
    {
        return new self("This account isn't waiting for review any more.");
    }
}
