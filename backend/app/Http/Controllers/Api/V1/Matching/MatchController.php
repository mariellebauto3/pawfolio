<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Matching;

use App\Enums\AccountStatus;
use App\Enums\HouseholdMember;
use App\Enums\PetStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Matching\ListMatchesRequest;
use App\Http\Resources\ErrorResource;
use App\Http\Resources\Profiles\HomeProfileResource;
use App\Http\Resources\Profiles\PetResource;
use App\Http\Resources\ResponseResource;
use App\Models\Bookmark;
use App\Models\HomeProfile;
use App\Models\MatchScore;
use App\Models\Pet;
use App\Models\User;
use App\Services\Matching\MatchScoreCalculator;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator as Paginator;

/**
 * Compatibility matches list and per-criterion breakdown (BE-13, MT-01..MT-05).
 */
class MatchController extends Controller
{
    /** Why an account has no list yet. The screens say it in their own words (MT-04, MT-05). */
    private const QUIZ_INCOMPLETE = 'quiz_incomplete';

    private const RESUME_DRAFT = 'resume_draft';

    private const ALREADY_ADOPTED = 'already_adopted';

    public function __construct(
        private readonly MatchScoreCalculator $calculator,
    ) {}

    /**
     * Pets for You (a human) or Homes for You (a pet): the pairs that pass every dealbreaker, best score first.
     * Always answers in the shape of a list; `meta.eligible` says whether the account has matches at all yet.
     */
    public function index(ListMatchesRequest $request)
    {
        $user = $request->user();

        return $user->isPet() ? $this->homesFor($user, $request) : $this->petsFor($user, $request);
    }

    private function petsFor(User $user, ListMatchesRequest $request): ResponseResource
    {
        $home = $user->homeProfile;
        if (! $home || ! $home->hasCompletedQuiz()) {
            return $this->notEligible($request, self::QUIZ_INCOMPLETE);
        }

        if (! MatchScore::query()->where('home_profile_id', $home->id)->exists()) {
            $this->calculator->recalculateForHome($home);
        }

        $query = MatchScore::query()
            ->with(['pet' => fn ($pet) => $pet
                ->with(['photos', 'temperamentTags', 'skills', 'specialNeeds', 'publishedAdoption.homeProfile'])
                // The view and bookmark counts of the whole page with the list, not one query per pet.
                ->withCount(['profileViews', 'bookmarks'])])
            ->where('home_profile_id', $home->id)
            ->whereHas('pet', function (Builder $pet) use ($request): void {
                $pet->where('status', PetStatus::LookingForAHome->value)
                    ->whereHas('user', fn ($u) => $u->where('status', AccountStatus::Active->value));

                // Each of these is a column with the same name as its filter; the values were checked against the enum.
                foreach (['species', 'size'] as $column) {
                    if (($values = $request->picked($column)) !== []) {
                        $pet->whereIn($column, $values);
                    }
                }

                // The same age groups as Browse pets and as the preferred-age answer of the quiz.
                if (($ageGroups = $request->picked('age')) !== []) {
                    $pet->where(function (Builder $sub) use ($ageGroups): void {
                        foreach ($ageGroups as $group) {
                            match ($group) {
                                'puppy_kitten' => $sub->orWhere('approximate_age_months', '<=', 12),
                                'adult' => $sub->orWhereBetween('approximate_age_months', [13, 84]),
                                'senior' => $sub->orWhere('approximate_age_months', '>', 84),
                            };
                        }
                    });
                }

                if (($city = $request->chosen('city')) !== null) {
                    $pet->where('city', $city);
                }
            });

        $paginator = $this->ranked($query, $request, Pet::query()->select('published_at')->whereColumn('pets.id', 'match_scores.pet_id'));

        $bookmarked = Bookmark::query()
            ->where('user_id', $user->id)
            ->whereIn('pet_id', $paginator->getCollection()->pluck('pet_id'))
            ->pluck('pet_id')
            ->flip();

        return $this->page($paginator, $paginator->getCollection()->map(function (MatchScore $match) use ($request, $home, $bookmarked): array {
            $evaluation = $this->calculator->evaluate($match->pet, $home);

            return $this->row($match, $evaluation) + [
                'pet' => (new PetResource($match->pet))
                    ->withMatch($match->score, $evaluation['reasons'])
                    ->withBookmarked($bookmarked->has($match->pet_id))
                    ->toArray($request),
            ];
        })->values()->all());
    }

    private function homesFor(User $user, ListMatchesRequest $request): ResponseResource
    {
        $pet = $user->pet;
        if (! $pet || $pet->getStatusEnum() === PetStatus::Draft) {
            return $this->notEligible($request, self::RESUME_DRAFT);
        }

        // A Hired pet has its home: its scores were removed with the adoption, and it isn't looking for another.
        if ($pet->getStatusEnum() === PetStatus::AdoptedHired) {
            return $this->notEligible($request, self::ALREADY_ADOPTED);
        }

        if (! MatchScore::query()->where('pet_id', $pet->id)->exists()) {
            $this->calculator->recalculateForPet($pet);
        }

        $query = MatchScore::query()
            ->with(['homeProfile' => fn ($home) => $home->with([
                'householdMembers',
                'otherPets',
                'acceptedSpecies',
                'preferredSizes',
                'preferredAges',
                'activeAdoptions.pet.photos',
            ])])
            ->where('pet_id', $pet->id)
            ->whereHas('homeProfile', function (Builder $home) use ($request): void {
                $home->where('is_open_to_adopt', true)
                    ->whereNotNull('quiz_completed_at')
                    ->whereHas('user', fn ($u) => $u->where('status', AccountStatus::Active->value));

                if (($types = $request->picked('home_type')) !== []) {
                    $home->whereIn('home_type', $types);
                }

                // "none" for homes with no other pets, and it wins over the kinds picked beside it (as in Browse).
                if (($otherPets = $request->picked('has_other_pets')) !== []) {
                    if (in_array('none', $otherPets, true)) {
                        $home->whereDoesntHave('otherPets');
                    } else {
                        $home->whereHas('otherPets', fn ($op) => $op->whereIn('pet_type', $otherPets));
                    }
                }

                // With or without young kids: the same two age groups the kids dealbreaker counts.
                $kids = [HouseholdMember::KidsUnder6->value, HouseholdMember::Kids6To12->value];
                match ($request->chosen('has_kids')) {
                    'yes' => $home->whereHas('householdMembers', fn ($m) => $m->whereIn('member', $kids)),
                    'no' => $home->whereDoesntHave('householdMembers', fn ($m) => $m->whereIn('member', $kids)),
                    default => null,
                };

                if (($city = $request->chosen('city')) !== null) {
                    $home->where('city', $city);
                }
            });

        $paginator = $this->ranked(
            $query,
            $request,
            HomeProfile::query()->select('quiz_completed_at')->whereColumn('home_profiles.id', 'match_scores.home_profile_id'),
        );

        $bookmarked = Bookmark::query()
            ->where('user_id', $user->id)
            ->whereIn('home_profile_id', $paginator->getCollection()->pluck('home_profile_id'))
            ->pluck('home_profile_id')
            ->flip();

        return $this->page($paginator, $paginator->getCollection()->map(function (MatchScore $match) use ($request, $pet, $bookmarked): array {
            $evaluation = $this->calculator->evaluate($pet, $match->homeProfile);

            return $this->row($match, $evaluation) + [
                'home_profile' => (new HomeProfileResource($match->homeProfile))
                    ->withMatch($match->score, $evaluation['reasons'])
                    ->withBookmarked($bookmarked->has($match->home_profile_id))
                    ->toArray($request),
            ];
        })->values()->all());
    }

    /**
     * How the viewer and one profile fit: the four dealbreakers, then the seven weighted criteria (MT-03).
     *
     * `{profile}` is the other side of the pair: a pet's id for a human, a Home Profile's id for a pet. The viewer's
     * own side comes from the session (SEC-AUTHZ-02). A profile the viewer may not open answers 404 here as it does
     * on its own page (PetPolicy, HomeProfilePolicy, SEC-AUTHZ-04), and so does a pair that has no score to explain:
     * a human who hasn't finished the quiz, a pet whose resume is a Draft, a home without quiz answers.
     */
    public function breakdown(Request $request, int $profile)
    {
        $user = $request->user();

        if ($user->isHuman()) {
            $home = $user->homeProfile;
            $pet = Pet::query()->with('user')->find($profile);
            $scored = $home && $home->hasCompletedQuiz() && $pet && $user->can('view', $pet);
        } elseif ($user->isPet()) {
            $pet = $user->pet;
            $home = HomeProfile::query()->with('user')->find($profile);
            $scored = $pet && $pet->getStatusEnum() !== PetStatus::Draft && $home && $home->hasCompletedQuiz() && $user->can('view', $home);
        } else {
            return ErrorResource::forbidden('Only pet and human accounts have matches.')->toResponse($request);
        }

        if (! $scored) {
            return ErrorResource::notFound("We couldn't find that match.")->toResponse($request);
        }

        $evaluation = $this->calculator->evaluate($pet, $home);

        return ResponseResource::make([
            'pet_id' => $pet->id,
            'home_profile_id' => $home->id,
            'score' => $evaluation['score'],
            'tier' => $this->tierForScore($evaluation['score']),
            'passed_dealbreakers' => $evaluation['passed_dealbreakers'],
            'failed_dealbreakers' => $evaluation['failed_dealbreakers'],
            'dealbreakers' => $evaluation['dealbreakers'],
            'criteria' => $evaluation['criteria'],
            'criteria_scores' => $evaluation['criteria_scores'],
            'reasons' => $evaluation['reasons'],
        ]);
    }

    /**
     * The score filters, the order and the page. Best match: the score, then the newest profile. Newest: the other
     * way round. Both end on the row's id, so a page is the same page when it is asked for again.
     */
    private function ranked(Builder $query, ListMatchesRequest $request, Builder $newest): LengthAwarePaginator
    {
        if (($min = $request->score('min_score')) !== null) {
            $query->where('score', '>=', $min);
        }
        if (($max = $request->score('max_score')) !== null) {
            $query->where('score', '<=', $max);
        }

        match ($request->chosen('tier')) {
            'high' => $query->where('score', '>=', 80),
            'medium' => $query->whereBetween('score', [60, 79]),
            'low' => $query->where('score', '<', 60),
            default => null,
        };

        if ($request->sort() === 'newest') {
            $query->orderByDesc($newest)->orderByDesc('score');
        } else {
            $query->orderByDesc('score')->orderByDesc($newest);
        }

        return $query->orderByDesc('match_scores.id')->paginate($request->perPage());
    }

    /**
     * What every row says about its pair, whichever side is reading.
     *
     * @param  array<string, mixed>  $evaluation
     * @return array<string, mixed>
     */
    private function row(MatchScore $match, array $evaluation): array
    {
        return [
            'id' => $match->id,
            'score' => $match->score,
            'tier' => $this->tierForScore($match->score),
            'passed_dealbreakers' => true,
            'reasons' => $evaluation['reasons'],
            'criteria_scores' => $evaluation['criteria_scores'],
            'calculated_at' => $match->calculated_at?->toISOString(),
        ];
    }

    /**
     * A page of matches, in the shape of every list plus whether the account has matches yet.
     *
     * @param  list<array<string, mixed>>  $rows
     */
    private function page(LengthAwarePaginator $paginator, array $rows, ?string $reason = null): ResponseResource
    {
        $page = ResponseResource::paginated($paginator, $rows);

        return new ResponseResource($page->data, $page->meta + ['eligible' => $reason === null, 'reason' => $reason], $page->links);
    }

    /** No list yet: an empty page, and why. Not an error, since the account may read its matches; it has none. */
    private function notEligible(ListMatchesRequest $request, string $reason): ResponseResource
    {
        $empty = new Paginator([], 0, $request->perPage(), 1, ['path' => $request->url()]);

        return $this->page($empty, [], $reason);
    }

    private function tierForScore(int $score): string
    {
        if ($score >= 80) {
            return 'high';
        }
        if ($score >= 60) {
            return 'medium';
        }

        return 'low';
    }
}
