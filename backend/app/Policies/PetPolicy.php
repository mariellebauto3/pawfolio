<?php

declare(strict_types=1);

namespace App\Policies;

use App\Enums\AccountStatus;
use App\Enums\PetStatus;
use App\Models\Pet;
use App\Models\User;

/**
 * Who may read pet resumes (DS-01, DS-05, DS-08). A resume that may not be seen answers 404, not 403, so ids can't be
 * probed (SEC-AUTHZ-04); the controller turns a refusal into that.
 */
class PetPolicy
{
    /** Browse and search: any Active account (SEC-AUTHZ-06). */
    public function viewAny(User $user): bool
    {
        return $user->isActive();
    }

    public function view(User $user, Pet $pet): bool
    {
        if ($user->id === $pet->user_id || $user->isAdmin()) {
            return true;
        }

        // Drafts are the pet's own business until they are published (PR-02).
        if ($pet->getStatusEnum() === PetStatus::Draft) {
            return false;
        }

        // A pending, suspended or deactivated account's resume is hidden (§5.1, SEC-PRIV-05).
        return $pet->user !== null && $pet->user->getStatus() === AccountStatus::Active;
    }
}
