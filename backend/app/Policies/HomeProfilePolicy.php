<?php

declare(strict_types=1);

namespace App\Policies;

use App\Enums\AccountStatus;
use App\Models\AdoptionRequest;
use App\Models\HomeProfile;
use App\Models\Invite;
use App\Models\User;

/**
 * Who may read Home Profiles (DS-02, DS-07). A home that may not be seen answers 404, not 403, so ids can't be probed
 * (SEC-AUTHZ-04); the controller turns a refusal into that.
 */
class HomeProfilePolicy
{
    /** Browse and search: any Active account (SEC-AUTHZ-06). */
    public function viewAny(User $user): bool
    {
        return $user->isActive();
    }

    public function view(User $user, HomeProfile $home): bool
    {
        if ($user->id === $home->user_id || $user->isAdmin()) {
            return true;
        }

        // A pending, suspended or deactivated account's home is hidden (§5.1, SEC-PRIV-05).
        if ($home->user === null || $home->user->getStatus() !== AccountStatus::Active) {
            return false;
        }

        if ($home->is_open_to_adopt) {
            return true;
        }

        // Open to Adopt is off: the home isn't shown, a Furparent's included (agreed 2026-10-08). The one exception
        // is a pet that already has a request or an invite with it (§5.5: turning it off doesn't end those), which
        // covers a pet this home adopted.
        $pet = $user->pet;
        if ($pet === null) {
            return false;
        }

        return AdoptionRequest::query()->where('pet_id', $pet->id)->where('home_profile_id', $home->id)->exists()
            || Invite::query()->where('pet_id', $pet->id)->where('home_profile_id', $home->id)->exists();
    }
}
