<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\AdoptionRequests;

use App\Actions\AdoptionRequests\SendInvite;
use App\Enums\AccountStatus;
use App\Enums\AdoptionRequestStatus;
use App\Exceptions\InviteRefused;
use App\Http\Controllers\Controller;
use App\Http\Requests\AdoptionRequests\ListInvitesRequest;
use App\Http\Requests\AdoptionRequests\SendInviteRequest;
use App\Http\Resources\ErrorResource;
use App\Http\Resources\PaginatedResource;
use App\Http\Resources\Profiles\HomeProfileResource;
use App\Http\Resources\ResponseResource;
use App\Models\AdoptionRequest;
use App\Models\Bookmark;
use App\Models\Invite;
use App\Models\MatchScore;
use App\Models\Pet;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

/**
 * Invite to Apply (BE-15, RQ-01, RQ-02, FR9, docs/api/bookmarks-and-invites.md): a human nudges a pet to apply, like
 * a recruiter reaching out. Applying stays the pet's choice.
 */
class InviteController extends Controller
{
    /** RQ-02: the invites the pet received and hasn't dismissed, newest first. */
    public function index(ListInvitesRequest $request): ResponseResource
    {
        $user = $request->user();
        // Null only for a pet account with no resume row, which then has no invites either.
        $petId = $user->pet?->id;

        $paginator = Invite::query()
            ->where('pet_id', $petId)
            ->active()
            // A suspended or deactivated account's home is hidden, and so is its invite (SEC-PRIV-05, SEC-ABUSE-04).
            ->whereHas('homeProfile.user', fn ($account) => $account->where('status', AccountStatus::Active->value))
            ->with([
                'homeProfile.user',
                'homeProfile.householdMembers',
                'homeProfile.otherPets',
                'homeProfile.acceptedSpecies',
                'homeProfile.preferredSizes',
                'homeProfile.preferredAges',
                'homeProfile.activeAdoptions.pet.photos',
            ])
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate($request->perPage());

        // What each card needs beside the invite, read once for the page instead of once a row.
        $homeIds = $paginator->getCollection()->pluck('home_profile_id');
        $scores = MatchScore::query()->where('pet_id', $petId)->whereIn('home_profile_id', $homeIds)->get()->keyBy('home_profile_id');
        $bookmarked = Bookmark::query()->where('user_id', $user->id)->whereIn('home_profile_id', $homeIds)->pluck('home_profile_id')->flip();
        $requests = AdoptionRequest::query()->where('pet_id', $petId)->whereIn('home_profile_id', $homeIds)->get()->groupBy('home_profile_id');

        return PaginatedResource::fromPaginator($paginator, function (Invite $invite) use ($request, $scores, $bookmarked, $requests): array {
            $homeId = $invite->home_profile_id;
            $history = $requests->get($homeId, collect());

            return [
                'id' => $invite->id,
                'note' => $invite->note,
                'created_at' => $invite->created_at?->toISOString(),
                // Why Apply may not be offered: the pet has a request with this home already, or was declined by it
                // less than 30 days ago (RQ-06). Open to Adopt off is on the home itself.
                'open_request_id' => $history->first(fn (AdoptionRequest $sent) => $sent->isOpen())?->id,
                'cooldown_until' => $this->cooldownUntil($history),
                'home_profile' => (new HomeProfileResource($invite->homeProfile))
                    ->withMatchScore($scores->get($homeId))
                    ->withBookmarked($bookmarked->has($homeId))
                    ->toArray($request),
            ];
        });
    }

    public function store(SendInviteRequest $request, int $pet, SendInvite $send): ResponseResource|JsonResponse
    {
        $user = $request->user();
        $invited = Pet::query()->with('user')->find($pet);

        // A pet the human may not see answers like one that doesn't exist (PetPolicy, SEC-AUTHZ-04).
        if ($invited === null || $user->cannot('view', $invited)) {
            return ErrorResource::notFound("We couldn't find that pet.")->toResponse($request);
        }

        try {
            $invite = $send($user, $invited, $request->note(), $request->userAgent());
        } catch (InviteRefused $refused) {
            return ErrorResource::conflict($refused->getMessage(), $refused->reason)->toResponse($request);
        }

        return ResponseResource::created([
            'id' => $invite->id,
            'pet_id' => $invite->pet_id,
            'home_profile_id' => $invite->home_profile_id,
            'note' => $invite->note,
            'created_at' => $invite->created_at?->toISOString(),
        ]);
    }

    public function dismiss(Request $request, int $invite): ResponseResource|JsonResponse
    {
        $found = Invite::query()->find($invite);

        // Another pet's invite, or anyone who isn't a pet, is answered like one that doesn't exist (SEC-AUTHZ-04).
        if ($found === null || $request->user()->cannot('dismiss', $found)) {
            return ErrorResource::notFound("We couldn't find that invite.")->toResponse($request);
        }

        // A second press keeps the first time and is not an error.
        if ($found->dismissed_at === null) {
            $found->dismissed_at = now();
            $found->save();
        }

        return ResponseResource::make([
            'id' => $found->id,
            'dismissed_at' => $found->dismissed_at->toISOString(),
        ]);
    }

    /**
     * When the pet may apply to this home again: 30 days after its last Declined or Not Adopted result there, or
     * null when that has passed or never happened (§5.3).
     *
     * @param  Collection<int, AdoptionRequest>  $history  The pet's requests with one home.
     */
    private function cooldownUntil(Collection $history): ?string
    {
        $lastRefusal = $history
            ->filter(fn (AdoptionRequest $sent) => $sent->closed_at !== null
                && in_array($sent->getStatus(), [AdoptionRequestStatus::Declined, AdoptionRequestStatus::NotAdopted], true))
            ->sortByDesc('closed_at')
            ->first();

        $until = $lastRefusal?->closed_at->copy()->addDays(AdoptionRequestController::COOLDOWN_DAYS);

        return $until !== null && $until->isFuture() ? $until->toISOString() : null;
    }
}
