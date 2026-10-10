<?php

declare(strict_types=1);

namespace App\Exceptions;

use RuntimeException;

/**
 * An admin's reminder on an adoption request has nobody to go to, or went out already (RQ-19, FR36). The API answers
 * 409 with `reason` as the code and the message as written here, which the screen shows as it is.
 */
class ReminderRefused extends RuntimeException
{
    private function __construct(string $message, public readonly string $reason)
    {
        parent::__construct($message);
    }

    /** Nobody has a step to take: the request is On Hold, ended, or its Meet & Greet is still ahead. */
    public static function nobodyToRemind(): self
    {
        return new self("Nobody has a step to take on this request right now, so there's no one to remind.", 'no_reminder_needed');
    }

    public static function alreadySent(): self
    {
        return new self('A reminder for this request already went out in the last 24 hours.', 'already_reminded');
    }
}
