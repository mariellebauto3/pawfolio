<?php

declare(strict_types=1);

namespace App\Exceptions;

use App\Models\Pet;
use RuntimeException;

/**
 * A rule stopped an Invite to Apply from being sent (RQ-01, FR9). The API answers 409 with `reason` as the code and
 * the message as written here, which the screen shows as it is.
 */
class InviteRefused extends RuntimeException
{
    private function __construct(string $message, public readonly string $reason)
    {
        parent::__construct($message);
    }

    /** Humans receive requests only while Open to Adopt is on (§5.5), so only then may they ask for one. */
    public static function notOpenToAdopt(): self
    {
        return new self('Finish your Home Profile and turn on Open to Adopt before you invite a pet to apply.', 'not_open_to_adopt');
    }

    public static function petNotLooking(Pet $pet): self
    {
        return new self("{$pet->name} isn't Looking for a Home right now.", 'pet_not_looking_for_home');
    }

    public static function alreadyApplied(Pet $pet): self
    {
        return new self("{$pet->name} has already applied to your home. Find the request in your Requests.", 'request_already_open');
    }

    public static function alreadySent(Pet $pet): self
    {
        return new self("You have already invited {$pet->name} to apply.", 'invite_already_sent');
    }
}
