<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Matching;

use App\Enums\AccountStatus;
use App\Enums\PetStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\ErrorResource;
use App\Http\Resources\PaginatedResource;
use App\Http\Resources\Profiles\HomeProfileResource;
use App\Http\Resources\Profiles\PetResource;
use App\Http\Resources\ResponseResource;
use App\Models\HomeProfile;
use App\Models\MatchScore;
use App\Models\Pet;
use App\Services\Matching\MatchScoreCalculator;
use Illuminate\Http\Request;

/**
 * Compatibility matches list and per-criterion breakdown (BE-13, MT-01..MT-05).
 */
class MatchController extends Controller
{
    public function __construct(
        private readonly MatchScoreCalculator $calculator,
    ) {}

    public function index(Request $request)
    {
        $user = $request->user();
        $perPage = min(max((int) $request->query('per_page', 20), 1), 50);

        if ($user->isPet()) {
            $pet = $user->pet;
            if (! $pet || $pet->getStatusEnum() === PetStatus::Draft) {
                return ResponseResource::make([
                    'is_eligible' => false,
                    'reason' => 'Publish your Pet Résumé to see compatible Home Profiles.',
                    'items' => [],
                    'meta' => [
                        'page' => 1,
                        'current_page' => 1,
                        'per_page' => $perPage,
                        'total' => 0,
                        'last_page' => 1,
                    ],
                ]);
            }

            if (! MatchScore::query()->where('pet_id', $pet->id)->exists()) {
                $this->calculator->recalculateForPet($pet);
            }

            $query = MatchScore::query()
                ->with([
                    'homeProfile.user',
                    'homeProfile.householdMembers',
                    'homeProfile.otherPets',
                    'homeProfile.acceptedSpecies',
                    'homeProfile.preferredSizes',
                    'homeProfile.preferredAges',
                    'homeProfile.activeAdoptions.pet.photos',
                ])
                ->where('pet_id', $pet->id)
                ->whereHas('homeProfile', function ($q) use ($request): void {
                    $q->where('is_open_to_adopt', true)
                        ->whereNotNull('quiz_completed_at')
                        ->whereHas('user', fn ($u) => $u->where('status', AccountStatus::Active->value));

                    if ($request->filled('city')) {
                        $q->where('city', $request->string('city')->toString());
                    }
                    if ($request->filled('home_type')) {
                        $types = array_filter(explode(',', $request->string('home_type')->toString()));
                        $q->whereIn('home_type', $types);
                    }
                });

            $this->applyScoreFilters($query, $request);
            $paginator = $query->orderByDesc('score')->orderByDesc('calculated_at')->paginate($perPage);

            return PaginatedResource::fromPaginator($paginator, function (MatchScore $match) use ($request, $pet): array {
                $evaluation = $this->calculator->evaluate($pet, $match->homeProfile);

                return [
                    'id' => $match->id,
                    'score' => $match->score,
                    'tier' => $this->tierForScore($match->score),
                    'passed_dealbreakers' => true,
                    'reasons' => $evaluation['reasons'],
                    'criteria_scores' => $evaluation['criteria_scores'],
                    'calculated_at' => $match->calculated_at?->toISOString(),
                    'home_profile' => (new HomeProfileResource($match->homeProfile))
                        ->withMatch($match->score, $evaluation['reasons'])
                        ->toArray($request),
                ];
            });
        }

        if ($user->isHuman()) {
            $home = $user->homeProfile;
            if (! $home || ! $home->hasCompletedQuiz()) {
                return ResponseResource::make([
                    'is_eligible' => false,
                    'reason' => 'Complete your 6-step lifestyle quiz to see compatible Pet Résumés.',
                    'items' => [],
                    'meta' => [
                        'page' => 1,
                        'current_page' => 1,
                        'per_page' => $perPage,
                        'total' => 0,
                        'last_page' => 1,
                    ],
                ]);
            }

            if (! MatchScore::query()->where('home_profile_id', $home->id)->exists()) {
                $this->calculator->recalculateForHome($home);
            }

            $query = MatchScore::query()
                ->with(['pet.user', 'pet.photos', 'pet.temperamentTags', 'pet.skills', 'pet.specialNeeds'])
                ->where('home_profile_id', $home->id)
                ->whereHas('pet', function ($q) use ($request): void {
                    $q->where('status', PetStatus::LookingForAHome->value)
                        ->whereHas('user', fn ($u) => $u->where('status', AccountStatus::Active->value));

                    if ($request->filled('species')) {
                        $species = array_filter(explode(',', $request->string('species')->toString()));
                        $q->whereIn('species', $species);
                    }
                    if ($request->filled('size')) {
                        $sizes = array_filter(explode(',', $request->string('size')->toString()));
                        $q->whereIn('size', $sizes);
                    }
                    if ($request->filled('city')) {
                        $q->where('city', $request->string('city')->toString());
                    }
                });

            $this->applyScoreFilters($query, $request);
            $paginator = $query->orderByDesc('score')->orderByDesc('calculated_at')->paginate($perPage);

            return PaginatedResource::fromPaginator($paginator, function (MatchScore $match) use ($request, $home): array {
                $evaluation = $this->calculator->evaluate($match->pet, $home);

                return [
                    'id' => $match->id,
                    'score' => $match->score,
                    'tier' => $this->tierForScore($match->score),
                    'passed_dealbreakers' => true,
                    'reasons' => $evaluation['reasons'],
                    'criteria_scores' => $evaluation['criteria_scores'],
                    'calculated_at' => $match->calculated_at?->toISOString(),
                    'pet' => (new PetResource($match->pet))
                        ->withMatch($match->score, $evaluation['reasons'])
                        ->toArray($request),
                ];
            });
        }

        return ErrorResource::forbidden('Only Pet and Furparent accounts have compatibility matches.')->toResponse($request);
    }

    public function breakdown(Request $request, int $id)
    {
        $user = $request->user();

        $matchScore = MatchScore::query()->with(['pet', 'homeProfile'])->find($id);

        if ($matchScore) {
            $ownsPet = $user->pet && $matchScore->pet_id === $user->pet->id;
            $ownsHome = $user->homeProfile && $matchScore->home_profile_id === $user->homeProfile->id;

            if ($ownsPet || $ownsHome || $user->isAdmin()) {
                $evaluation = $this->calculator->evaluate($matchScore->pet, $matchScore->homeProfile);

                return ResponseResource::make([
                    'id' => $matchScore->id,
                    'pet_id' => $matchScore->pet_id,
                    'home_profile_id' => $matchScore->home_profile_id,
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
        }

        if ($user->isHuman() && $user->homeProfile) {
            $pet = Pet::query()->find($id);
            if (! $pet || $pet->getStatusEnum() === PetStatus::Draft) {
                return ErrorResource::notFound('Match not found.')->toResponse($request);
            }

            $stored = $this->calculator->persistPair($pet, $user->homeProfile);
            $evaluation = $this->calculator->evaluate($pet, $user->homeProfile);

            return ResponseResource::make([
                'id' => $stored?->id,
                'pet_id' => $pet->id,
                'home_profile_id' => $user->homeProfile->id,
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

        if ($user->isPet() && $user->pet) {
            $home = HomeProfile::query()->find($id);
            if (! $home) {
                return ErrorResource::notFound('Match not found.')->toResponse($request);
            }

            $stored = $this->calculator->persistPair($user->pet, $home);
            $evaluation = $this->calculator->evaluate($user->pet, $home);

            return ResponseResource::make([
                'id' => $stored?->id,
                'pet_id' => $user->pet->id,
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

        return ErrorResource::notFound('Match not found.')->toResponse($request);
    }

    private function applyScoreFilters($query, Request $request): void
    {
        if ($request->filled('min_score')) {
            $query->where('score', '>=', (int) $request->query('min_score'));
        }
        if ($request->filled('max_score')) {
            $query->where('score', '<=', (int) $request->query('max_score'));
        }
        if ($request->filled('tier')) {
            match ($request->string('tier')->toString()) {
                'high' => $query->where('score', '>=', 80),
                'medium' => $query->whereBetween('score', [60, 79]),
                'low' => $query->where('score', '<', 60),
                default => null,
            };
        }
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
