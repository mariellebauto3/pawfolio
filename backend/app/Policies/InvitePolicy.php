<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\Invite;
use App\Models\User;

/**
 * Who may use Invites to Apply (RQ-01, RQ-02, FR9): a human sends them and the invited pet reads and dismisses them.
 * Which pet may be invited is PetPolicy's to say, and the rules of sending are the SendInvite action's.
 */
class InvitePolicy
{
    /** The Invites to Apply screen is the pet's (RQ-02). */
    public function viewAny(User $user): bool
    {
        return $user->isActive() && $user->isPet();
    }

    public function create(User $user): bool
    {
        return $user->isActive() && $user->isHuman();
    }

    /** Only the pet that was invited; anyone else is answered 404 (SEC-AUTHZ-04). */
    public function dismiss(User $user, Invite $invite): bool
    {
        return $user->isPet() && $user->pet !== null && $invite->pet_id === $user->pet->id;
    }
}
