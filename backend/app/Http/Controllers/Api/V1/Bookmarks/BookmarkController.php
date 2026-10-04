<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Bookmarks;

use App\Enums\PetStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\ErrorResource;
use App\Http\Resources\PaginatedResource;
use App\Http\Resources\Profiles\HomeProfileResource;
use App\Http\Resources\Profiles\PetResource;
use App\Http\Resources\ResponseResource;
use App\Models\Bookmark;
use App\Models\HomeProfile;
use App\Models\Pet;
use Illuminate\Http\Request;

/**
 * Saved items / bookmarks for pets and home profiles (BE-15, BM-01..BM-04).
 */
class BookmarkController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $perPage = min(max((int) $request->query('per_page', 20), 1), 50);

        $query = Bookmark::query()
            ->with([
                'pet.photos',
                'pet.temperamentTags',
                'pet.skills',
                'pet.specialNeeds',
                'homeProfile.householdMembers',
                'homeProfile.otherPets',
                'homeProfile.acceptedSpecies',
                'homeProfile.preferredSizes',
                'homeProfile.preferredAges',
            ])
            ->where('user_id', $user->id)
            ->orderByDesc('created_at')
            ->orderByDesc('id');

        if ($request->filled('type')) {
            $type = $request->string('type')->toString();
            if ($type === 'pet') {
                $query->whereNotNull('pet_id');
            } elseif (in_array($type, ['home_profile', 'home'], true)) {
                $query->whereNotNull('home_profile_id');
            }
        }

        $paginator = $query->paginate($perPage);

        return PaginatedResource::fromPaginator($paginator, function (Bookmark $bookmark) use ($request): array {
            $type = $bookmark->pet_id !== null ? 'pet' : 'home_profile';
            $targetId = $bookmark->pet_id ?? $bookmark->home_profile_id;

            $target = null;
            if ($bookmark->pet !== null) {
                $target = (new PetResource($bookmark->pet))->toArray($request);
            } elseif ($bookmark->homeProfile !== null) {
                $target = (new HomeProfileResource($bookmark->homeProfile))->toArray($request);
            }

            return [
                'id' => $bookmark->id,
                'type' => $type,
                'bookmarkable_type' => $type,
                'bookmarkable_id' => $targetId,
                'pet_id' => $bookmark->pet_id,
                'home_profile_id' => $bookmark->home_profile_id,
                'target' => $target,
                'pet' => $bookmark->pet ? (new PetResource($bookmark->pet))->toArray($request) : null,
                'home_profile' => $bookmark->homeProfile ? (new HomeProfileResource($bookmark->homeProfile))->toArray($request) : null,
                'created_at' => $bookmark->created_at?->toISOString(),
            ];
        });
    }

    public function store(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'pet_id' => ['nullable', 'integer', 'min:1'],
            'home_profile_id' => ['nullable', 'integer', 'min:1'],
            'bookmarkable_type' => ['nullable', 'string', 'in:pet,home_profile,home'],
            'bookmarkable_id' => ['nullable', 'integer', 'min:1'],
        ]);

        $petId = isset($validated['pet_id']) ? (int) $validated['pet_id'] : null;
        $homeProfileId = isset($validated['home_profile_id']) ? (int) $validated['home_profile_id'] : null;

        if ($petId === null && $homeProfileId === null && ! empty($validated['bookmarkable_type']) && ! empty($validated['bookmarkable_id'])) {
            if ($validated['bookmarkable_type'] === 'pet') {
                $petId = (int) $validated['bookmarkable_id'];
            } else {
                $homeProfileId = (int) $validated['bookmarkable_id'];
            }
        }

        if (($petId === null && $homeProfileId === null) || ($petId !== null && $homeProfileId !== null)) {
            return ErrorResource::validationFailed('Choose either a pet or a Home Profile to bookmark.', [
                'bookmarkable_id' => ['Choose either a pet or a Home Profile to bookmark.'],
            ])->toResponse($request);
        }

        if ($petId !== null) {
            $exists = Pet::query()
                ->where('id', $petId)
                ->where('status', '!=', PetStatus::Draft->value)
                ->exists();

            if (! $exists) {
                return ErrorResource::notFound('Pet not found.')->toResponse($request);
            }

            $bookmark = Bookmark::query()->where('user_id', $user->id)->where('pet_id', $petId)->first();
            if (! $bookmark) {
                $bookmark = new Bookmark;
                $bookmark->user_id = $user->id;
                $bookmark->pet_id = $petId;
                $bookmark->save();
            }

            return ResponseResource::created([
                'id' => $bookmark->id,
                'type' => 'pet',
                'bookmarkable_type' => 'pet',
                'bookmarkable_id' => $petId,
                'pet_id' => $petId,
                'home_profile_id' => null,
                'created_at' => $bookmark->created_at?->toISOString(),
            ]);
        }

        $exists = HomeProfile::query()
            ->where('id', $homeProfileId)
            ->exists();

        if (! $exists) {
            return ErrorResource::notFound('Home Profile not found.')->toResponse($request);
        }

        $bookmark = Bookmark::query()->where('user_id', $user->id)->where('home_profile_id', $homeProfileId)->first();
        if (! $bookmark) {
            $bookmark = new Bookmark;
            $bookmark->user_id = $user->id;
            $bookmark->home_profile_id = $homeProfileId;
            $bookmark->save();
        }

        return ResponseResource::created([
            'id' => $bookmark->id,
            'type' => 'home_profile',
            'bookmarkable_type' => 'home_profile',
            'bookmarkable_id' => $homeProfileId,
            'pet_id' => null,
            'home_profile_id' => $homeProfileId,
            'created_at' => $bookmark->created_at?->toISOString(),
        ]);
    }

    public function destroyByTarget(Request $request, string $type, int $id)
    {
        $user = $request->user();

        $query = Bookmark::query()->where('user_id', $user->id);
        if ($type === 'pet') {
            $query->where('pet_id', $id);
        } elseif (in_array($type, ['home_profile', 'home'], true)) {
            $query->where('home_profile_id', $id);
        } else {
            return ErrorResource::notFound('Bookmark not found.')->toResponse($request);
        }

        $deleted = $query->delete();
        if (! $deleted) {
            return ErrorResource::notFound('Bookmark not found.')->toResponse($request);
        }

        return ResponseResource::make(['removed' => true]);
    }

    public function destroy(Request $request, Bookmark $bookmark)
    {
        $user = $request->user();
        if ($bookmark->user_id !== $user->id) {
            return ErrorResource::notFound('Bookmark not found.')->toResponse($request);
        }

        $bookmark->delete();

        return ResponseResource::make(['removed' => true]);
    }
}
