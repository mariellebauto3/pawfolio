<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Discovery;

use App\Enums\AccountStatus;
use App\Enums\AdoptionRequestStatus;
use App\Enums\HouseholdMember;
use App\Enums\MeetAndGreetStatus;
use App\Enums\PetGoodWith;
use App\Enums\PetStatus;
use App\Enums\ProfileViewSource;
use App\Http\Controllers\Controller;
use App\Http\Requests\Discovery\BrowseHomeProfilesRequest;
use App\Http\Requests\Discovery\BrowsePetsRequest;
use App\Http\Requests\Discovery\SearchRequest;
use App\Http\Resources\ErrorResource;
use App\Http\Resources\PaginatedResource;
use App\Http\Resources\Profiles\HomeProfileResource;
use App\Http\Resources\Profiles\PetResource;
use App\Http\Resources\ResponseResource;
use App\Models\AdoptionRequest;
use App\Models\Bookmark;
use App\Models\HomeProfile;
use App\Models\MatchScore;
use App\Models\MeetAndGreet;
use App\Models\Pet;
use App\Models\PetVetRecord;
use App\Models\Post;
use App\Models\ProfileView;
use App\Services\Matching\MatchScoreCalculator;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;

/**
 * Discovery browse, profile detail, unified search, private vet record download, and public recently-hired (BE-14, DS-01..DS-08, AU-01).
 */
class DiscoveryController extends Controller
{
    public function __construct(
        private readonly MatchScoreCalculator $matcher,
    ) {}

    public function browsePets(BrowsePetsRequest $request)
    {
        $user = $request->user();

        $query = Pet::query()
            ->with(['photos', 'temperamentTags', 'skills', 'specialNeeds', 'user', 'publishedAdoption.homeProfile'])
            ->where('pets.status', $request->status())
            ->whereHas('user', fn ($u) => $u->where('status', AccountStatus::Active->value));

        if (($term = $request->chosen('q')) !== null) {
            $like = '%'.addcslashes($term, '%_\\').'%';
            $query->where(function ($sub) use ($like): void {
                $sub->where('pets.name', 'like', $like)
                    ->orWhere('pets.breed', 'like', $like)
                    ->orWhere('pets.city', 'like', $like)
                    ->orWhere('pets.bio', 'like', $like)
                    ->orWhereHas('temperamentTags', fn ($t) => $t->where('tag', 'like', $like));
            });
        }

        // Each of these is a column with the same name as its filter; the values were checked against the enum.
        foreach (['species', 'size', 'sex', 'energy_level'] as $column) {
            if (($values = $request->picked($column)) !== []) {
                $query->whereIn("pets.{$column}", $values);
            }
        }

        if (($ageGroups = $request->picked('age')) !== []) {
            $query->where(function ($sub) use ($ageGroups): void {
                foreach ($ageGroups as $group) {
                    match ($group) {
                        'baby', 'puppy_kitten' => $sub->orWhere('pets.approximate_age_months', '<=', 12),
                        'young' => $sub->orWhereBetween('pets.approximate_age_months', [13, 35]),
                        'adult' => $sub->orWhereBetween('pets.approximate_age_months', [13, 84]),
                        'senior' => $sub->orWhere('pets.approximate_age_months', '>', 84),
                    };
                }
            });
        }

        // Pets that answered Yes to every one picked.
        $goodWith = $request->picked('good_with');
        foreach (['kids' => 'good_with_kids', 'dogs' => 'good_with_dogs', 'cats' => 'good_with_cats'] as $value => $column) {
            if (in_array($value, $goodWith, true)) {
                $query->where("pets.{$column}", PetGoodWith::Yes->value);
            }
        }

        // Pets with any of the picked temperament tags (FR6, DS-01).
        if (($tags = $request->picked('temperament')) !== []) {
            $query->whereHas('temperamentTags', fn ($t) => $t->whereIn('tag', $tags));
        }

        if (($province = $request->chosen('province')) !== null) {
            $query->where('pets.province', $province);
        }

        if (($city = $request->chosen('city')) !== null) {
            $query->where('pets.city', $city);
        }

        match ($request->chosen('special_needs')) {
            'none' => $query->whereDoesntHave('specialNeeds'),
            'any' => $query->whereHas('specialNeeds'),
            default => null,
        };

        $sort = $request->sort();
        $viewerHome = $user?->homeProfile;

        if ($sort === 'best_match' && $viewerHome && $viewerHome->hasCompletedQuiz()) {
            $query->leftJoin('match_scores', function ($join) use ($viewerHome): void {
                $join->on('match_scores.pet_id', '=', 'pets.id')
                    ->where('match_scores.home_profile_id', '=', $viewerHome->id);
            })
                ->select('pets.*')
                // Pets without a score go last on every engine: PostgreSQL would put them first in a descending sort.
                ->orderByRaw('CASE WHEN match_scores.score IS NULL THEN 1 ELSE 0 END')
                ->orderByDesc('match_scores.score')
                ->orderByDesc('pets.published_at');
        } elseif ($sort === 'name_asc') {
            $query->orderBy('pets.name', 'asc');
        } else {
            $query->orderByDesc('pets.published_at')->orderByDesc('pets.id');
        }

        // The view and bookmark counts of the whole page in the list query, not one query per pet.
        $paginator = $query->withCount(['profileViews', 'bookmarks'])->paginate($request->perPage());

        $petIds = $paginator->getCollection()->pluck('id')->all();
        $scoresByPetId = collect();
        if ($viewerHome && $petIds !== []) {
            $scoresByPetId = MatchScore::query()
                ->where('home_profile_id', $viewerHome->id)
                ->whereIn('pet_id', $petIds)
                ->get()
                ->keyBy('pet_id');
        }

        $bookmarkedIds = $user && $petIds !== []
            ? Bookmark::query()
                ->where('user_id', $user->id)
                ->whereIn('pet_id', $petIds)
                ->pluck('pet_id')
                ->flip()
            : collect();

        return PaginatedResource::fromPaginator($paginator, function (Pet $pet) use ($request, $scoresByPetId, $bookmarkedIds): array {
            return (new PetResource($pet))
                ->withMatchScore($scoresByPetId->get($pet->id))
                ->withBookmarked($bookmarkedIds->has($pet->id))
                ->toArray($request);
        });
    }

    public function showPet(Request $request, Pet $pet)
    {
        $viewer = $request->user();
        $isOwner = $viewer && $viewer->id === $pet->user_id;
        $isAdmin = $viewer && $viewer->isAdmin();

        $pet->loadMissing(['user', 'photos', 'temperamentTags', 'skills', 'specialNeeds', 'vetRecords', 'publishedAdoption.homeProfile']);

        // A resume the viewer may not see answers like one that doesn't exist (PetPolicy, SEC-AUTHZ-04).
        if (! $viewer || $viewer->cannot('view', $pet)) {
            return ErrorResource::notFound("We couldn't find that pet.")->toResponse($request);
        }

        if ($viewer && ! $isOwner && ! $isAdmin) {
            $source = ProfileViewSource::tryFrom($request->string('source', 'direct')->toString()) ?? ProfileViewSource::Direct;
            $this->recordPetView($viewer->id, $pet->id, $source);
        }

        $matchEvaluation = null;
        if ($viewer && $viewer->isHuman() && $viewer->homeProfile && $viewer->homeProfile->hasCompletedQuiz()) {
            $this->matcher->persistPair($pet, $viewer->homeProfile);
            $matchEvaluation = $this->matcher->evaluate($pet, $viewer->homeProfile);
        }

        $hasApprovedAccess = $viewer && $viewer->homeProfile
            && $this->hasApprovedAdoptionAccess($viewer->homeProfile->id, $pet->id);
        $hasConfirmedMeet = $viewer && $viewer->homeProfile
            && $this->hasConfirmedMeetAndGreet($pet->id, $viewer->homeProfile->id);

        $resource = new PetResource($pet);
        if ($isOwner || $isAdmin) {
            $resource->forOwner();
        } elseif ($hasConfirmedMeet) {
            $resource->withConfirmedMeetAndGreetContact();
        }

        if ($matchEvaluation !== null && $matchEvaluation['passed_dealbreakers']) {
            $resource->withMatch($matchEvaluation['score'], $matchEvaluation['reasons']);
        }

        $data = $resource->toArray($request);

        if ($hasApprovedAccess && ! isset($data['vet_records'])) {
            $data['vet_records'] = $pet->vetRecords->map(fn ($record) => [
                'id' => $record->id,
                'mime_type' => $record->mime_type,
                'size_bytes' => (int) $record->size_bytes,
                'uploaded_at' => ($record->created_at ?? now())->toISOString(),
                'download_url' => "/api/v1/pets/{$pet->id}/vet-records/{$record->id}",
            ])->values()->all();
        }

        if ($matchEvaluation !== null) {
            $data['match'] = $matchEvaluation;
        }

        return ResponseResource::make($data);
    }

    public function downloadVetRecord(Request $request, Pet $pet, PetVetRecord $record)
    {
        if ($record->pet_id !== $pet->id) {
            return ErrorResource::notFound('Vet record not found.')->toResponse($request);
        }

        $viewer = $request->user();
        if (! $viewer) {
            return ErrorResource::unauthenticated()->toResponse($request);
        }

        $isOwner = $viewer->id === $pet->user_id;
        $isAdmin = $viewer->isAdmin();
        $hasApprovedRequest = $viewer->homeProfile
            && $this->hasApprovedAdoptionAccess($viewer->homeProfile->id, $pet->id);

        if (! $isOwner && ! $isAdmin && ! $hasApprovedRequest) {
            return ErrorResource::forbidden('Vet records are private until an adoption request is approved.')->toResponse($request);
        }

        $disk = Storage::disk('local')->exists($record->file_path)
            ? 'local'
            : (Storage::disk('public')->exists($record->file_path) ? 'public' : null);

        if ($disk === null) {
            return ErrorResource::notFound('Vet record file not found on storage.')->toResponse($request);
        }

        $contents = Storage::disk($disk)->get($record->file_path);

        return response($contents, 200, [
            'Content-Type' => $record->mime_type,
            'Content-Length' => (string) strlen($contents),
            'Content-Disposition' => 'inline; filename="'.basename($record->file_path).'"',
            'Cache-Control' => 'private, no-store, max-age=0',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function browseHomeProfiles(BrowseHomeProfilesRequest $request)
    {
        $user = $request->user();

        $query = HomeProfile::query()
            ->with(['user', 'householdMembers', 'otherPets', 'acceptedSpecies', 'preferredSizes', 'preferredAges', 'activeAdoptions.pet.photos'])
            ->where('home_profiles.is_open_to_adopt', true)
            ->whereNotNull('home_profiles.quiz_completed_at')
            ->whereHas('user', fn ($u) => $u->where('status', AccountStatus::Active->value));

        if (($term = $request->chosen('q')) !== null) {
            $like = '%'.addcslashes($term, '%_\\').'%';
            $query->where(function ($sub) use ($like): void {
                $sub->where('home_profiles.full_name', 'like', $like)
                    ->orWhere('home_profiles.headline', 'like', $like)
                    ->orWhere('home_profiles.city', 'like', $like)
                    ->orWhere('home_profiles.about_home', 'like', $like);
            });
        }

        // Each of these is a column with the same name as its filter; the values were checked against the enum.
        foreach (['home_type', 'outdoor_space', 'activity_level', 'pet_experience'] as $column) {
            if (($values = $request->picked($column)) !== []) {
                $query->whereIn("home_profiles.{$column}", $values);
            }
        }

        if (($species = $request->picked('accepted_species')) !== []) {
            $query->whereHas('acceptedSpecies', fn ($s) => $s->whereIn('species', $species));
        }

        if (($sizes = $request->picked('preferred_size')) !== []) {
            $query->whereHas('preferredSizes', fn ($s) => $s->whereIn('size', $sizes));
        }

        if (($province = $request->chosen('province')) !== null) {
            $query->where('home_profiles.province', $province);
        }

        if (($city = $request->chosen('city')) !== null) {
            $query->where('home_profiles.city', $city);
        }

        // "none" for homes with no other pets, and it wins over the kinds picked beside it.
        if (($otherPets = $request->picked('has_other_pets')) !== []) {
            if (in_array('none', $otherPets, true)) {
                $query->whereDoesntHave('otherPets');
            } else {
                $query->whereHas('otherPets', fn ($op) => $op->whereIn('pet_type', $otherPets));
            }
        }

        // Homes with or without young kids (DS-02): the same two age groups the kids dealbreaker counts.
        $kids = [HouseholdMember::KidsUnder6->value, HouseholdMember::Kids6To12->value];
        match ($request->chosen('has_kids')) {
            'yes' => $query->whereHas('householdMembers', fn ($m) => $m->whereIn('member', $kids)),
            'no' => $query->whereDoesntHave('householdMembers', fn ($m) => $m->whereIn('member', $kids)),
            default => null,
        };

        $sort = $request->sort();
        $viewerPet = $user?->pet;

        if ($sort === 'best_match' && $viewerPet && $viewerPet->getStatusEnum() !== PetStatus::Draft) {
            $query->leftJoin('match_scores', function ($join) use ($viewerPet): void {
                $join->on('match_scores.home_profile_id', '=', 'home_profiles.id')
                    ->where('match_scores.pet_id', '=', $viewerPet->id);
            })
                ->select('home_profiles.*')
                // Homes without a score go last on every engine: PostgreSQL would put them first in a descending sort.
                ->orderByRaw('CASE WHEN match_scores.score IS NULL THEN 1 ELSE 0 END')
                ->orderByDesc('match_scores.score')
                ->orderByDesc('home_profiles.quiz_completed_at');
        } else {
            $query->orderByDesc('home_profiles.quiz_completed_at')->orderByDesc('home_profiles.id');
        }

        $paginator = $query->paginate($request->perPage());

        $homeIds = $paginator->getCollection()->pluck('id')->all();
        $scoresByHomeId = collect();
        if ($viewerPet && $homeIds !== []) {
            $scoresByHomeId = MatchScore::query()
                ->where('pet_id', $viewerPet->id)
                ->whereIn('home_profile_id', $homeIds)
                ->get()
                ->keyBy('home_profile_id');
        }

        $bookmarkedIds = $user && $homeIds !== []
            ? Bookmark::query()
                ->where('user_id', $user->id)
                ->whereIn('home_profile_id', $homeIds)
                ->pluck('home_profile_id')
                ->flip()
            : collect();

        return PaginatedResource::fromPaginator($paginator, function (HomeProfile $home) use ($request, $scoresByHomeId, $bookmarkedIds): array {
            return (new HomeProfileResource($home))
                ->withMatchScore($scoresByHomeId->get($home->id))
                ->withBookmarked($bookmarkedIds->has($home->id))
                ->toArray($request);
        });
    }

    public function showHomeProfile(Request $request, HomeProfile $home)
    {
        $viewer = $request->user();
        $isOwner = $viewer && $viewer->id === $home->user_id;
        $isAdmin = $viewer && $viewer->isAdmin();

        $home->loadMissing(['user', 'householdMembers', 'otherPets', 'acceptedSpecies', 'preferredSizes', 'preferredAges', 'activeAdoptions.pet.photos']);

        // A home the viewer may not see answers like one that doesn't exist (HomeProfilePolicy, SEC-AUTHZ-04).
        if (! $viewer || $viewer->cannot('view', $home)) {
            return ErrorResource::notFound("We couldn't find that Home Profile.")->toResponse($request);
        }

        if ($viewer && ! $isOwner && ! $isAdmin) {
            $source = ProfileViewSource::tryFrom($request->string('source', 'direct')->toString()) ?? ProfileViewSource::Direct;
            $this->recordHomeView($viewer->id, $home->id, $source);
        }

        $matchEvaluation = null;
        if ($viewer && $viewer->isPet() && $viewer->pet && $viewer->pet->getStatusEnum() !== PetStatus::Draft && $home->hasCompletedQuiz()) {
            $this->matcher->persistPair($viewer->pet, $home);
            $matchEvaluation = $this->matcher->evaluate($viewer->pet, $home);
        }

        $resource = new HomeProfileResource($home);
        if ($isOwner || $isAdmin) {
            $resource->forOwner();
        } elseif ($viewer && $viewer->pet && $this->hasConfirmedMeetAndGreet($viewer->pet->id, $home->id)) {
            $resource->withConfirmedMeetAndGreetContact();
        }

        if ($matchEvaluation !== null && $matchEvaluation['passed_dealbreakers']) {
            $resource->withMatch($matchEvaluation['score'], $matchEvaluation['reasons']);
        }

        $data = $resource->toArray($request);
        if ($matchEvaluation !== null) {
            $data['match'] = $matchEvaluation;
        }

        return ResponseResource::make($data);
    }

    public function search(SearchRequest $request)
    {
        $q = $request->words();
        $like = '%'.addcslashes($q, '%_\\').'%';
        $activeAccount = fn ($u) => $u->where('status', AccountStatus::Active->value);

        // The same three lists whether they are counted, previewed or paged through. Each has a fixed order, so a
        // page is the same page when it is asked for again.
        $pets = Pet::query()
            ->with(['photos', 'temperamentTags', 'skills', 'specialNeeds'])
            ->where('status', PetStatus::LookingForAHome->value)
            ->whereHas('user', $activeAccount)
            ->where(function ($sub) use ($like): void {
                $sub->where('name', 'like', $like)
                    ->orWhere('breed', 'like', $like)
                    ->orWhere('city', 'like', $like)
                    ->orWhere('bio', 'like', $like);
            })
            ->orderByDesc('published_at')
            ->orderByDesc('id');

        $homes = HomeProfile::query()
            ->with(['householdMembers', 'otherPets', 'acceptedSpecies', 'preferredSizes', 'preferredAges'])
            ->where('is_open_to_adopt', true)
            ->whereNotNull('quiz_completed_at')
            ->whereHas('user', $activeAccount)
            ->where(function ($sub) use ($like): void {
                $sub->where('full_name', 'like', $like)
                    ->orWhere('headline', 'like', $like)
                    ->orWhere('city', 'like', $like)
                    ->orWhere('about_home', 'like', $like);
            })
            ->orderByDesc('quiz_completed_at')
            ->orderByDesc('id');

        $posts = Post::query()
            ->visible()
            ->with(['author.pet.photos', 'author.homeProfile', 'photos'])
            ->whereHas('author', $activeAccount)
            ->where(function ($sub) use ($like): void {
                $sub->where('title', 'like', $like)
                    ->orWhere('body', 'like', $like);
            })
            ->orderByDesc('created_at')
            ->orderByDesc('id');

        // Nothing typed finds nothing, in the same shape as a search that finds nothing.
        if ($q === '') {
            foreach ([$pets, $homes, $posts] as $list) {
                $list->whereRaw('1 = 0');
            }
        }

        // How many there are of each kind, whichever kind is being read (DS-03's counts).
        $totals = [
            'pets' => (clone $pets)->count(),
            'home_profiles' => (clone $homes)->count(),
            'posts' => (clone $posts)->count(),
        ];

        $type = $request->type();

        // The overview: the first few of each kind.
        if ($type === null) {
            $limit = $request->limit();

            return ResponseResource::make([
                'query' => $q,
                'pets' => $this->petRows($pets->withCount(['profileViews', 'bookmarks'])->limit($limit)->get(), $request),
                'home_profiles' => $this->homeRows($homes->limit($limit)->get(), $request),
                'posts' => $this->postRows($posts->limit($limit)->get()),
                'totals' => $totals,
            ]);
        }

        // One kind, a page at a time (SEC-API-05).
        if ($type === 'pets') {
            $paginator = $pets->withCount(['profileViews', 'bookmarks'])->paginate($request->perPage());
            $rows = $this->petRows($paginator->getCollection(), $request);
        } elseif ($type === 'home_profiles') {
            $paginator = $homes->paginate($request->perPage());
            $rows = $this->homeRows($paginator->getCollection(), $request);
        } else {
            $paginator = $posts->paginate($request->perPage());
            $rows = $this->postRows($paginator->getCollection());
        }

        $page = ResponseResource::paginated($paginator, $rows);

        return new ResponseResource($page->data, $page->meta + ['query' => $q, 'totals' => $totals], $page->links);
    }

    /**
     * Pets as list rows, with the viewer's bookmarks read once for all of them.
     *
     * @param  Collection<int, Pet>  $pets
     * @return list<array<string, mixed>>
     */
    private function petRows(Collection $pets, Request $request): array
    {
        $bookmarked = Bookmark::query()
            ->where('user_id', $request->user()->id)
            ->whereIn('pet_id', $pets->pluck('id'))
            ->pluck('pet_id')
            ->flip();

        return $pets
            ->map(fn (Pet $pet) => (new PetResource($pet))->withBookmarked($bookmarked->has($pet->id))->toArray($request))
            ->values()
            ->all();
    }

    /**
     * Home Profiles as list rows, with the viewer's bookmarks read once for all of them.
     *
     * @param  Collection<int, HomeProfile>  $homes
     * @return list<array<string, mixed>>
     */
    private function homeRows(Collection $homes, Request $request): array
    {
        $bookmarked = Bookmark::query()
            ->where('user_id', $request->user()->id)
            ->whereIn('home_profile_id', $homes->pluck('id'))
            ->pluck('home_profile_id')
            ->flip();

        return $homes
            ->map(fn (HomeProfile $home) => (new HomeProfileResource($home))->withBookmarked($bookmarked->has($home->id))->toArray($request))
            ->values()
            ->all();
    }

    /**
     * Posts as search rows: enough to recognise one and open it.
     *
     * @param  Collection<int, Post>  $posts
     * @return list<array<string, mixed>>
     */
    private function postRows(Collection $posts): array
    {
        return $posts
            ->map(fn (Post $post) => [
                'id' => $post->id,
                'type' => $post->getPostType()->value,
                'title' => $post->title,
                'body' => $post->body,
                'author_name' => $post->author?->displayName(),
                'created_at' => $post->created_at?->toISOString(),
            ])
            ->values()
            ->all();
    }

    /**
     * Public "Recently Hired" showcase on the landing page (AU-01, docs/api/discovery.md).
     *
     * At most 8 pets, newest adoption first, exposing only `{ name, photo_url, hired_at }` (NFR4, SEC-PRIV-03).
     */
    public function recentlyHired()
    {
        $pets = Pet::query()
            ->with(['photos', 'publishedAdoption'])
            ->where('status', PetStatus::AdoptedHired->value)
            ->whereHas('user', fn ($u) => $u->where('status', AccountStatus::Active->value))
            ->whereHas('publishedAdoption')
            ->get()
            ->sortByDesc(fn (Pet $pet) => $pet->publishedAdoption?->adopted_at?->getTimestamp() ?? 0)
            ->take(8)
            ->values();

        $items = $pets->map(function (Pet $pet): array {
            $firstPhoto = $pet->photos->sortBy('sort_order')->first();

            return [
                'name' => $pet->name,
                'photo_url' => $firstPhoto ? Storage::disk('public')->url($firstPhoto->file_path) : null,
                'hired_at' => ($pet->publishedAdoption?->adopted_at ?? $pet->updated_at)?->toISOString(),
            ];
        })->values()->all();

        return ResponseResource::collection($items);
    }

    private function recordPetView(int $viewerUserId, int $petId, ProfileViewSource $source): void
    {
        $alreadyViewedToday = ProfileView::query()
            ->where('viewer_user_id', $viewerUserId)
            ->where('pet_id', $petId)
            ->where('created_at', '>=', now()->startOfDay())
            ->exists();

        if (! $alreadyViewedToday) {
            $view = new ProfileView;
            $view->viewer_user_id = $viewerUserId;
            $view->pet_id = $petId;
            $view->source = $source->value;
            $view->save();
        }
    }

    private function recordHomeView(int $viewerUserId, int $homeProfileId, ProfileViewSource $source): void
    {
        $alreadyViewedToday = ProfileView::query()
            ->where('viewer_user_id', $viewerUserId)
            ->where('home_profile_id', $homeProfileId)
            ->where('created_at', '>=', now()->startOfDay())
            ->exists();

        if (! $alreadyViewedToday) {
            $view = new ProfileView;
            $view->viewer_user_id = $viewerUserId;
            $view->home_profile_id = $homeProfileId;
            $view->source = $source->value;
            $view->save();
        }
    }

    private function hasApprovedAdoptionAccess(int $homeProfileId, int $petId): bool
    {
        return AdoptionRequest::query()
            ->where('pet_id', $petId)
            ->where('home_profile_id', $homeProfileId)
            ->whereIn('status', [
                AdoptionRequestStatus::Approved->value,
                AdoptionRequestStatus::MeetScheduled->value,
                AdoptionRequestStatus::AwaitingDecision->value,
                AdoptionRequestStatus::Adopted->value,
            ])
            ->exists();
    }

    private function hasConfirmedMeetAndGreet(int $petId, int $homeProfileId): bool
    {
        return MeetAndGreet::query()
            ->whereHas('request', function ($q) use ($petId, $homeProfileId): void {
                $q->where('pet_id', $petId)
                    ->where('home_profile_id', $homeProfileId);
            })
            ->where('status', MeetAndGreetStatus::Confirmed->value)
            ->exists();
    }
}
