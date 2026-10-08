<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\AdoptionRequest;
use App\Models\User;

/**
 * Who may use adoption requests as the pet that sends them (RQ-03…RQ-08, RQ-14…RQ-17, FR24, FR25). A request is
 * between one pet and one human: only those two and admins read it (SEC-AUTHZ-03), and anyone else is answered 404,
 * so ids can't be probed (SEC-AUTHZ-04). The rules of sending (3 open, 1 in process, the cooldown) are the
 * controller's, inside its transaction.
 */
class AdoptionRequestPolicy
{
    /** My requests and the human's inbox. An admin has the monitor under /admin instead (RQ-18). */
    public function viewAny(User $user): bool
    {
        return $user->isActive() && ($user->isPet() || $user->isHuman());
    }

    public function view(User $user, AdoptionRequest $request): bool
    {
        return $user->isAdmin() || $this->sent($user, $request) || $this->received($user, $request);
    }

    /** Only a pet applies (proposal §9). */
    public function create(User $user): bool
    {
        return $user->isActive() && $user->isPet() && $user->pet !== null;
    }

    /** Only the pet that sent it (FR25). */
    public function withdraw(User $user, AdoptionRequest $request): bool
    {
        return $this->sent($user, $request);
    }

    private function sent(User $user, AdoptionRequest $request): bool
    {
        return $user->isPet() && $user->pet !== null && $request->pet_id === $user->pet->id;
    }

    private function received(User $user, AdoptionRequest $request): bool
    {
        return $user->isHuman() && $user->homeProfile !== null && $request->home_profile_id === $user->homeProfile->id;
    }
}
