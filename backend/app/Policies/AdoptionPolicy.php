<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\Adoption;
use App\Models\User;

/**
 * Who may read an adoption record (AL-06, FR14): the timeline, the days to adoption and the cover letter of the
 * request behind it. Like that request, it is between one pet and one human: only those two and admins read it
 * (SEC-AUTHZ-03), and anyone else is answered 404, so ids can't be probed (SEC-AUTHZ-04). The public side of an
 * adoption, "Hired by …", is on the pet's resume instead.
 */
class AdoptionPolicy
{
    public function view(User $user, Adoption $adoption): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        // A link an admin removed (AL-07) is history: its two sides read the request it came from, not this.
        if (! $adoption->isActiveLink()) {
            return false;
        }

        return ($user->isPet() && $user->pet !== null && $adoption->pet_id === $user->pet->id)
            || ($user->isHuman() && $user->homeProfile !== null && $adoption->home_profile_id === $user->homeProfile->id);
    }
}
