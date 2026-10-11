<?php

declare(strict_types=1);

namespace App\Exceptions;

use App\Models\Pet;
use RuntimeException;

/**
 * An admin's resolution doesn't apply to the pet or the request as they stand now (AL-07, AL-08, FR37). The API
 * answers 409 with `reason` as the code and the message as written here, which the screen shows as it is.
 */
class ResolutionRefused extends RuntimeException
{
    private function __construct(string $message, public readonly string $reason)
    {
        parent::__construct($message);
    }

    /** The action isn't offered for this pet; `$why` is the sentence the Resolve screen already shows under it. */
    public static function notAvailable(string $why): self
    {
        return new self($why, 'resolution_not_available');
    }

    /** The action applies to another of the pet's requests, or the request moved on while the form was open. */
    public static function wrongRequest(Pet $pet): self
    {
        return new self("That change no longer applies to this request. Reload the page to see where {$pet->name} stands.", 'resolution_not_available');
    }

    public static function chooseRequest(): self
    {
        return new self('Choose the request this change is for.', 'resolution_request_required');
    }
}
