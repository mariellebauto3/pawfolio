<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Bookmarks;

use App\Actions\Bookmarks\SaveBookmark;
use App\Enums\AccountStatus;
use App\Enums\PetStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Bookmarks\ListBookmarksRequest;
use App\Http\Requests\Bookmarks\StoreBookmarkRequest;
use App\Http\Resources\ErrorResource;
use App\Http\Resources\PaginatedResource;
use App\Http\Resources\Profiles\HomeProfileResource;
use App\Http\Resources\Profiles\PetResource;
use App\Http\Resources\ResponseResource;
use App\Models\Bookmark;
use App\Models\HomeProfile;
use App\Models\MatchScore;
use App\Models\Pet;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * Bookmarks: a human saves pets and a pet saves homes (BE-15, BM-01…BM-04, FR8, FR23,
 * docs/api/bookmarks-and-invites.md).
 */
class BookmarkController extends Controller
{
    public function index(ListBookmarksRequest $request): ResponseResource
    {
        $user = $request->user();

        return $user->isHuman() ? $this->savedPets($request, $user) : $this->savedHomes($request, $user);
    }

    public function store(StoreBookmarkRequest $request, SaveBookmark $save): ResponseResource|JsonResponse
    {
        $user = $request->user();

        // A profile the account may not see answers like one that doesn't exist (PetPolicy, HomeProfilePolicy,
        // SEC-AUTHZ-04), so a bookmark can't be used to learn that a hidden one is there.
        if (($petId = $request->petId()) !== null) {
            $target = Pet::query()->with('user')->find($petId);
            if ($target === null || $user->cannot('view', $target)) {
                return ErrorResource::notFound("We couldn't find that pet.")->toResponse($request);
            }

            // An adopted pet's profile shows no Bookmark (DS-08), and the API agrees (SEC-FE-05).
            if ($target->getStatusEnum() === PetStatus::AdoptedHired) {
                return ErrorResource::conflict(
                    "{$target->name} has already been adopted, so this resume can't be bookmarked.",
                    'pet_already_adopted',
                )->toResponse($request);
            }
        } else {
            $target = HomeProfile::query()->with('user')->find($request->homeProfileId());
            if ($target === null || $user->cannot('view', $target)) {
                return ErrorResource::notFound("We couldn't find that Home Profile.")->toResponse($request);
            }
        }

        $bookmark = $save($user, $target);

        return new ResponseResource(
            [
                'id' => $bookmark->id,
                'pet_id' => $bookmark->pet_id,
                'home_profile_id' => $bookmark->home_profile_id,
                'created_at' => $bookmark->created_at?->toISOString(),
            ],
            status: $bookmark->wasRecentlyCreated ? 201 : 200,
        );
    }

    public function destroy(Request $request, int $bookmark): Response|JsonResponse
    {
        $found = Bookmark::query()->find($bookmark);

        // Someone else's bookmark answers like one that doesn't exist (SEC-AUTHZ-04).
        if ($found === null || $request->user()->cannot('delete', $found)) {
            return ErrorResource::notFound("We couldn't find that bookmark.")->toResponse($request);
        }

        $found->delete();

        return response()->noContent();
    }

    public function destroyPet(Request $request, int $pet): Response
    {
        return $this->unsave($request, 'pet_id', $pet);
    }

    public function destroyHomeProfile(Request $request, int $home): Response
    {
        return $this->unsave($request, 'home_profile_id', $home);
    }

    /**
     * Removes the account's own bookmark of one profile. The profile isn't looked up: it may be hidden by now, and
     * the bookmark still has to go. Nothing to remove is the same answer, so pressing twice is not an error.
     */
    private function unsave(Request $request, string $column, int $targetId): Response
    {
        Bookmark::query()->where('user_id', $request->user()->id)->where($column, $targetId)->delete();

        return response()->noContent();
    }

    /** BM-01: the pets a human saved, newest save first, each with the human's match. */
    private function savedPets(ListBookmarksRequest $request, User $user): ResponseResource
    {
        $paginator = $this->own($user)
            // The same pets PetPolicy lets the human open: published, on an Active account (SEC-PRIV-05).
            ->whereHas('pet', fn ($pet) => $pet
                ->where('status', '!=', PetStatus::Draft->value)
                ->whereHas('user', fn ($account) => $account->where('status', AccountStatus::Active->value)))
            ->with([
                'pet' => fn ($pet) => $pet->withCount(['profileViews', 'bookmarks']),
                'pet.user',
                'pet.photos',
                'pet.temperamentTags',
                'pet.skills',
                'pet.specialNeeds',
                'pet.publishedAdoption.homeProfile.user',
            ])
            ->paginate($request->perPage());

        $home = $user->homeProfile;
        $scores = $home === null
            ? collect()
            : MatchScore::query()
                ->where('home_profile_id', $home->id)
                ->whereIn('pet_id', $paginator->getCollection()->pluck('pet_id'))
                ->get()
                ->keyBy('pet_id');

        return PaginatedResource::fromPaginator($paginator, fn (Bookmark $bookmark): array => [
            'id' => $bookmark->id,
            'created_at' => $bookmark->created_at?->toISOString(),
            'pet' => (new PetResource($bookmark->pet))
                ->withMatchScore($scores->get($bookmark->pet_id))
                ->withBookmarked(true)
                ->toArray($request),
        ]);
    }

    /** BM-02: the homes a pet saved, newest save first, each with the pet's match. */
    private function savedHomes(ListBookmarksRequest $request, User $user): ResponseResource
    {
        $pet = $user->pet;

        $paginator = $this->own($user)
            // The same homes HomeProfilePolicy lets the pet open: on an Active account, and Open to Adopt unless
            // the pet has a request or an invite with it (§5.5).
            ->whereHas('homeProfile', function ($home) use ($pet): void {
                $home
                    ->whereHas('user', fn ($account) => $account->where('status', AccountStatus::Active->value))
                    ->where(function ($shown) use ($pet): void {
                        $shown->where('is_open_to_adopt', true);

                        if ($pet !== null) {
                            $shown
                                ->orWhereHas('adoptionRequests', fn ($sent) => $sent->where('pet_id', $pet->id))
                                ->orWhereHas('invites', fn ($invite) => $invite->where('pet_id', $pet->id));
                        }
                    });
            })
            ->with([
                'homeProfile.user',
                'homeProfile.householdMembers',
                'homeProfile.otherPets',
                'homeProfile.acceptedSpecies',
                'homeProfile.preferredSizes',
                'homeProfile.preferredAges',
                'homeProfile.activeAdoptions.pet.photos',
            ])
            ->paginate($request->perPage());

        $scores = $pet === null
            ? collect()
            : MatchScore::query()
                ->where('pet_id', $pet->id)
                ->whereIn('home_profile_id', $paginator->getCollection()->pluck('home_profile_id'))
                ->get()
                ->keyBy('home_profile_id');

        return PaginatedResource::fromPaginator($paginator, fn (Bookmark $bookmark): array => [
            'id' => $bookmark->id,
            'created_at' => $bookmark->created_at?->toISOString(),
            'home_profile' => (new HomeProfileResource($bookmark->homeProfile))
                ->withMatchScore($scores->get($bookmark->home_profile_id))
                ->withBookmarked(true)
                ->toArray($request),
        ]);
    }

    /** The account's own bookmarks, newest first; the id settles two saved in the same second. */
    private function own(User $user)
    {
        return Bookmark::query()
            ->where('user_id', $user->id)
            ->orderByDesc('created_at')
            ->orderByDesc('id');
    }
}
