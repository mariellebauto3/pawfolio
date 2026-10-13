<?php

declare(strict_types=1);

namespace App\Services\CommunityFeed;

use App\Enums\AccountStatus;
use App\Enums\PetStatus;
use App\Models\Bookmark;
use App\Models\PetPhoto;
use App\Models\User;
use Illuminate\Support\Facades\Storage;

/** Only the signed-in member's home cards, never the full profile or other modules' lists. */
class HomeFeedSummary
{
    public function forUser(User $user): ?array
    {
        if ($user->isPet()) {
            $pet = $user->pet()->select(['id', 'user_id', 'name', 'breed', 'city', 'status', 'approximate_age_months'])
                ->selectSub(PetPhoto::query()->select('file_path')->whereColumn('pet_photos.pet_id', 'pets.id')
                    ->orderBy('sort_order')->orderBy('id')->limit(1), 'auth_avatar_path')
                ->withCount(['profileViews', 'bookmarks', 'invites as live_invites_count' => fn ($invites) => $invites->active()
                    ->whereHas('homeProfile.user', fn ($account) => $account->where('status', AccountStatus::Active->value))])->first();
            if (! $pet) {
                return null;
            }
            $user->setRelation('pet', $pet);
            $photo = $pet->auth_avatar_path;

            return [
                'name' => $pet->name,
                'avatar_url' => $photo ? Storage::disk('public')->url($photo) : null,
                'city' => $pet->city,
                'breed' => $pet->breed,
                'approximate_age_months' => $pet->approximate_age_months,
                'pet_status' => $pet->status->value,
                'views_count' => (int) $pet->profile_views_count,
                'bookmarks_count' => (int) $pet->bookmarks_count,
                'invites_count' => (int) $pet->live_invites_count,
                'story_pets' => [],
            ];
        }
        if (! $user->isHuman()) {
            return null;
        }
        $home = $user->homeProfile()->select(['id', 'user_id', 'full_name', 'city', 'home_type', 'profile_photo_path', 'is_open_to_adopt', 'furparent_at'])
            ->selectSub(Bookmark::query()->where('user_id', $user->id)
                ->whereHas('pet', fn ($pet) => $pet->where('status', '!=', PetStatus::Draft->value)
                    ->whereHas('user', fn ($account) => $account->where('status', AccountStatus::Active->value)))
                ->selectRaw('COUNT(*)'), 'saved_pets_count')
            ->withCount('profileViews')->first();
        if (! $home) {
            return null;
        }

        return [
            'name' => $home->full_name,
            'avatar_url' => $home->profile_photo_path ? Storage::disk('public')->url($home->profile_photo_path) : null,
            'city' => $home->city,
            'home_type' => $home->home_type,
            'is_open_to_adopt' => $home->is_open_to_adopt,
            'is_furparent' => $home->isFurparent(),
            'views_count' => (int) $home->profile_views_count,
            'saved_pets_count' => (int) $home->saved_pets_count,
            'story_pets' => $home->activeAdoptions()->whereNotNull('adopted_at')
                ->select(['id', 'home_profile_id', 'pet_id', 'adopted_at'])->with('pet:id,name')->get()
                ->filter(fn ($adoption) => $adoption->pet !== null)
                ->map(fn ($adoption) => ['id' => $adoption->pet->id, 'name' => $adoption->pet->name, 'adopted_at' => $adoption->adopted_at->toISOString()])
                ->values()->all(),
        ];
    }
}
