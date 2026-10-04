<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Discovery;

use App\Enums\AccountStatus;
use App\Enums\AdoptionRequestStatus;
use App\Enums\MeetAndGreetStatus;
use App\Enums\PetGoodWith;
use App\Enums\PetStatus;
use App\Enums\ProfileViewSource;
use App\Http\Controllers\Controller;
use App\Http\Resources\ErrorResource;
use App\Http\Resources\PaginatedResource;
use App\Http\Resources\Profiles\HomeProfileResource;
use App\Http\Resources\Profiles\PetResource;
use App\Http\Resources\ResponseResource;
use App\Models\AdoptionRequest;
use App\Models\Bookmark;
use App\Models\HomeProfile;
use App\Models\Invite;
use App\Models\MatchScore;
use App\Models\MeetAndGreet;
use App\Models\Pet;
use App\Models\PetVetRecord;
use App\Models\Post;
use App\Models\ProfileView;
use App\Services\Matching\MatchScoreCalculator;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/**
 * Discovery browse, profile detail, unified search, private vet record download, and public recently-hired (BE-14, DS-01..DS-08, AU-01).
 */
class DiscoveryController extends Controller
{
    public function __construct(
        private readonly MatchScoreCalculator $matcher,
    ) {}

    public function browsePets(Request $request)
    {
        $user = $request->user();
        $perPage = min(max((int) $request->query('per_page', 20), 1), 50);

        $statusFilter = $request->string('status', PetStatus::LookingForAHome->value)->toString();
        $allowedStatuses = [
            PetStatus::LookingForAHome->value,
            PetStatus::InProcess->value,
        ];
        if (! in_array($statusFilter, $allowedStatuses, true)) {
            $statusFilter = PetStatus::LookingForAHome->value;
        }

        $query = Pet::query()
            ->with(['photos', 'temperamentTags', 'skills', 'specialNeeds', 'user', 'publishedAdoption.homeProfile'])
            ->where('pets.status', $statusFilter)
            ->whereHas('user', fn ($u) => $u->where('status', AccountStatus::Active->value));

        if ($request->filled('q')) {
            $term = trim($request->string('q')->toString());
            if ($term !== '') {
                $like = '%'.addcslashes($term, '%_\\').'%';
                $query->where(function ($sub) use ($like): void {
                    $sub->where('pets.name', 'like', $like)
                        ->orWhere('pets.breed', 'like', $like)
                        ->orWhere('pets.city', 'like', $like)
                        ->orWhere('pets.bio', 'like', $like)
                        ->orWhereHas('temperamentTags', fn ($t) => $t->where('tag', 'like', $like));
                });
            }
        }

        if ($request->filled('species')) {
            $species = array_values(array_filter(explode(',', $request->string('species')->toString())));
            if ($species !== []) {
                $query->whereIn('pets.species', $species);
            }
        }

        if ($request->filled('size')) {
            $sizes = array_values(array_filter(explode(',', $request->string('size')->toString())));
            if ($sizes !== []) {
                $query->whereIn('pets.size', $sizes);
            }
        }

        if ($request->filled('sex')) {
            $sexes = array_values(array_filter(explode(',', $request->string('sex')->toString())));
            if ($sexes !== []) {
                $query->whereIn('pets.sex', $sexes);
            }
        }

        if ($request->filled('energy_level')) {
            $levels = array_values(array_filter(explode(',', $request->string('energy_level')->toString())));
            if ($levels !== []) {
                $query->whereIn('pets.energy_level', $levels);
            }
        }

        if ($request->filled('age')) {
            $ageGroups = array_values(array_filter(explode(',', $request->string('age')->toString())));
            if ($ageGroups !== []) {
                $query->where(function ($sub) use ($ageGroups): void {
                    foreach ($ageGroups as $group) {
                        match ($group) {
                            'baby', 'puppy_kitten' => $sub->orWhere('pets.approximate_age_months', '<=', 12),
                            'young' => $sub->orWhereBetween('pets.approximate_age_months', [13, 35]),
                            'adult' => $sub->orWhereBetween('pets.approximate_age_months', [13, 84]),
                            'senior' => $sub->orWhere('pets.approximate_age_months', '>', 84),
                            default => null,
                        };
                    }
                });
            }
        }

        if ($request->filled('good_with')) {
            $goodWith = array_values(array_filter(explode(',', $request->string('good_with')->toString())));
            if (in_array('kids', $goodWith, true)) {
                $query->where('pets.good_with_kids', PetGoodWith::Yes->value);
            }
            if (in_array('dogs', $goodWith, true)) {
                $query->where('pets.good_with_dogs', PetGoodWith::Yes->value);
            }
            if (in_array('cats', $goodWith, true)) {
                $query->where('pets.good_with_cats', PetGoodWith::Yes->value);
            }
        }

        if ($request->filled('province')) {
            $query->where('pets.province', $request->string('province')->toString());
        }

        if ($request->filled('city')) {
            $query->where('pets.city', $request->string('city')->toString());
        }

        if ($request->filled('special_needs')) {
            $sn = $request->string('special_needs')->toString();
            if ($sn === 'none') {
                $query->whereDoesntHave('specialNeeds');
            } elseif ($sn === 'any') {
                $query->whereHas('specialNeeds');
            }
        }

        $sort = $request->string('sort', 'best_match')->toString();
        $viewerHome = $user?->homeProfile;

        if ($sort === 'best_match' && $viewerHome && $viewerHome->hasCompletedQuiz()) {
            $query->leftJoin('match_scores', function ($join) use ($viewerHome): void {
                $join->on('match_scores.pet_id', '=', 'pets.id')
                    ->where('match_scores.home_profile_id', '=', $viewerHome->id);
            })
                ->select('pets.*')
                ->orderByDesc('match_scores.score')
                ->orderByDesc('pets.published_at');
        } elseif ($sort === 'name_asc') {
            $query->orderBy('pets.name', 'asc');
        } else {
            $query->orderByDesc('pets.published_at')->orderByDesc('pets.id');
        }

        $paginator = $query->paginate($perPage);

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
            $resource = (new PetResource($pet))
                ->withMatchScore($scoresByPetId->get($pet->id))
                ->toArray($request);
            $resource['is_bookmarked'] = $bookmarkedIds->has($pet->id);

            return $resource;
        });
    }

    public function showPet(Request $request, Pet $pet)
    {
        $viewer = $request->user();
        $isOwner = $viewer && $viewer->id === $pet->user_id;
        $isAdmin = $viewer && $viewer->isAdmin();

        // Draft resumes are never publicly visible (SEC-PRIV-06, PR-02).
        if ($pet->getStatusEnum() === PetStatus::Draft && ! $isOwner && ! $isAdmin) {
            return ErrorResource::notFound("We couldn't find that pet.")->toResponse($request);
        }

        $pet->loadMissing(['user', 'photos', 'temperamentTags', 'skills', 'specialNeeds', 'vetRecords', 'publishedAdoption.homeProfile']);

        if (! $isOwner && ! $isAdmin && $pet->user && $pet->user->getStatus() !== AccountStatus::Active) {
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

    public function browseHomeProfiles(Request $request)
    {
        $user = $request->user();
        $perPage = min(max((int) $request->query('per_page', 20), 1), 50);

        $query = HomeProfile::query()
            ->with(['user', 'householdMembers', 'otherPets', 'acceptedSpecies', 'preferredSizes', 'preferredAges', 'activeAdoptions.pet.photos'])
            ->where('home_profiles.is_open_to_adopt', true)
            ->whereNotNull('home_profiles.quiz_completed_at')
            ->whereHas('user', fn ($u) => $u->where('status', AccountStatus::Active->value));

        if ($request->filled('q')) {
            $term = trim($request->string('q')->toString());
            if ($term !== '') {
                $like = '%'.addcslashes($term, '%_\\').'%';
                $query->where(function ($sub) use ($like): void {
                    $sub->where('home_profiles.full_name', 'like', $like)
                        ->orWhere('home_profiles.headline', 'like', $like)
                        ->orWhere('home_profiles.city', 'like', $like)
                        ->orWhere('home_profiles.about_home', 'like', $like);
                });
            }
        }

        if ($request->filled('home_type')) {
            $types = array_values(array_filter(explode(',', $request->string('home_type')->toString())));
            if ($types !== []) {
                $query->whereIn('home_profiles.home_type', $types);
            }
        }

        if ($request->filled('outdoor_space')) {
            $spaces = array_values(array_filter(explode(',', $request->string('outdoor_space')->toString())));
            if ($spaces !== []) {
                $query->whereIn('home_profiles.outdoor_space', $spaces);
            }
        }

        if ($request->filled('activity_level')) {
            $levels = array_values(array_filter(explode(',', $request->string('activity_level')->toString())));
            if ($levels !== []) {
                $query->whereIn('home_profiles.activity_level', $levels);
            }
        }

        if ($request->filled('pet_experience')) {
            $exp = array_values(array_filter(explode(',', $request->string('pet_experience')->toString())));
            if ($exp !== []) {
                $query->whereIn('home_profiles.pet_experience', $exp);
            }
        }

        if ($request->filled('accepted_species')) {
            $species = array_values(array_filter(explode(',', $request->string('accepted_species')->toString())));
            if ($species !== []) {
                $query->whereHas('acceptedSpecies', fn ($s) => $s->whereIn('species', $species));
            }
        }

        if ($request->filled('preferred_size')) {
            $sizes = array_values(array_filter(explode(',', $request->string('preferred_size')->toString())));
            if ($sizes !== []) {
                $query->whereHas('preferredSizes', fn ($s) => $s->whereIn('size', $sizes));
            }
        }

        if ($request->filled('province')) {
            $query->where('home_profiles.province', $request->string('province')->toString());
        }

        if ($request->filled('city')) {
            $query->where('home_profiles.city', $request->string('city')->toString());
        }

        if ($request->filled('has_other_pets')) {
            $otherPets = array_values(array_filter(explode(',', $request->string('has_other_pets')->toString())));
            if ($otherPets !== []) {
                if (in_array('none', $otherPets, true)) {
                    $query->whereDoesntHave('otherPets');
                } else {
                    $query->whereHas('otherPets', fn ($op) => $op->whereIn('pet_type', $otherPets));
                }
            }
        }

        $sort = $request->string('sort', 'best_match')->toString();
        $viewerPet = $user?->pet;

        if ($sort === 'best_match' && $viewerPet && $viewerPet->getStatusEnum() !== PetStatus::Draft) {
            $query->leftJoin('match_scores', function ($join) use ($viewerPet): void {
                $join->on('match_scores.home_profile_id', '=', 'home_profiles.id')
                    ->where('match_scores.pet_id', '=', $viewerPet->id);
            })
                ->select('home_profiles.*')
                ->orderByDesc('match_scores.score')
                ->orderByDesc('home_profiles.quiz_completed_at');
        } else {
            $query->orderByDesc('home_profiles.quiz_completed_at')->orderByDesc('home_profiles.id');
        }

        $paginator = $query->paginate($perPage);

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
            $resource = (new HomeProfileResource($home))
                ->withMatchScore($scoresByHomeId->get($home->id))
                ->toArray($request);
            $resource['is_bookmarked'] = $bookmarkedIds->has($home->id);

            return $resource;
        });
    }

    public function showHomeProfile(Request $request, HomeProfile $home)
    {
        $viewer = $request->user();
        $isOwner = $viewer && $viewer->id === $home->user_id;
        $isAdmin = $viewer && $viewer->isAdmin();

        $home->loadMissing(['user', 'householdMembers', 'otherPets', 'acceptedSpecies', 'preferredSizes', 'preferredAges', 'activeAdoptions.pet.photos']);

        if (! $isOwner && ! $isAdmin) {
            if (! $home->user || $home->user->getStatus() !== AccountStatus::Active) {
                return ErrorResource::notFound("We couldn't find that Home Profile.")->toResponse($request);
            }

            if (! $home->is_open_to_adopt) {
                $hasRelationship = false;
                if ($viewer && $viewer->pet) {
                    $hasRelationship = AdoptionRequest::query()
                        ->where('pet_id', $viewer->pet->id)
                        ->where('home_profile_id', $home->id)
                        ->exists()
                        || Invite::query()
                            ->where('pet_id', $viewer->pet->id)
                            ->where('home_profile_id', $home->id)
                            ->exists();
                }

                if (! $hasRelationship) {
                    return ErrorResource::notFound("We couldn't find that Home Profile.")->toResponse($request);
                }
            }
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

    public function search(Request $request)
    {
        $q = trim($request->string('q')->toString());
        $limit = min(max((int) $request->query('limit', 10), 1), 25);

        if ($q === '') {
            return ResponseResource::make([
                'query' => '',
                'pets' => [],
                'home_profiles' => [],
                'posts' => [],
            ]);
        }

        $like = '%'.addcslashes($q, '%_\\').'%';

        $pets = Pet::query()
            ->with(['photos', 'temperamentTags', 'skills', 'specialNeeds'])
            ->where('status', PetStatus::LookingForAHome->value)
            ->whereHas('user', fn ($u) => $u->where('status', AccountStatus::Active->value))
            ->where(function ($sub) use ($like): void {
                $sub->where('name', 'like', $like)
                    ->orWhere('breed', 'like', $like)
                    ->orWhere('city', 'like', $like)
                    ->orWhere('bio', 'like', $like);
            })
            ->limit($limit)
            ->get()
            ->map(fn (Pet $pet) => (new PetResource($pet))->toArray($request))
            ->values()
            ->all();

        $homes = HomeProfile::query()
            ->with(['householdMembers', 'otherPets', 'acceptedSpecies', 'preferredSizes', 'preferredAges'])
            ->where('is_open_to_adopt', true)
            ->whereNotNull('quiz_completed_at')
            ->whereHas('user', fn ($u) => $u->where('status', AccountStatus::Active->value))
            ->where(function ($sub) use ($like): void {
                $sub->where('full_name', 'like', $like)
                    ->orWhere('headline', 'like', $like)
                    ->orWhere('city', 'like', $like)
                    ->orWhere('about_home', 'like', $like);
            })
            ->limit($limit)
            ->get()
            ->map(fn (HomeProfile $home) => (new HomeProfileResource($home))->toArray($request))
            ->values()
            ->all();

        $posts = Post::query()
            ->visible()
            ->with(['author.pet.photos', 'author.homeProfile', 'photos'])
            ->whereHas('author', fn ($u) => $u->where('status', AccountStatus::Active->value))
            ->where(function ($sub) use ($like): void {
                $sub->where('title', 'like', $like)
                    ->orWhere('body', 'like', $like);
            })
            ->orderByDesc('created_at')
            ->limit($limit)
            ->get()
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

        return ResponseResource::make([
            'query' => $q,
            'pets' => $pets,
            'home_profiles' => $homes,
            'posts' => $posts,
        ]);
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
