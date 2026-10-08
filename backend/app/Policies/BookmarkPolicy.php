<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\Bookmark;
use App\Models\User;

/**
 * Who may keep bookmarks (BM-01…BM-04, FR8, FR23): a human saves pets and a pet saves homes. An admin has nothing to
 * save. Which profile may be saved is PetPolicy's and HomeProfilePolicy's to say.
 */
class BookmarkPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isActive() && ($user->isPet() || $user->isHuman());
    }

    public function create(User $user): bool
    {
        return $this->viewAny($user);
    }

    /** Only the account that saved it; anyone else is answered 404 (SEC-AUTHZ-04). */
    public function delete(User $user, Bookmark $bookmark): bool
    {
        return $bookmark->user_id === $user->id;
    }
}
