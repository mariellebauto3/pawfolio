<?php

declare(strict_types=1);

namespace App\Actions\Bookmarks;

use App\Models\Bookmark;
use App\Models\HomeProfile;
use App\Models\Pet;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;

/**
 * Saves a pet or a home to an account's bookmarks (BM-03, FR8, FR23). Saving the same one twice keeps the first
 * bookmark, so a second press or a second tab is not an error; `wasRecentlyCreated` tells the two apart.
 */
class SaveBookmark
{
    public function __invoke(User $user, Pet|HomeProfile $target): Bookmark
    {
        $column = $target instanceof Pet ? 'pet_id' : 'home_profile_id';
        $saved = fn () => Bookmark::query()->where('user_id', $user->id)->where($column, $target->id);

        if (($bookmark = $saved()->first()) !== null) {
            return $bookmark;
        }

        try {
            $bookmark = new Bookmark;
            $bookmark->user_id = $user->id;
            $bookmark->{$column} = $target->id;
            $bookmark->save();

            return $bookmark;
        } catch (UniqueConstraintViolationException) {
            // Saved by another request between the look and the write: the unique key kept it to one.
            return $saved()->firstOrFail();
        }
    }
}
