<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Profiles;

use App\Enums\AcceptedSpecies;
use App\Enums\ActivityLevel;
use App\Enums\ActivityLogType;
use App\Enums\HomeType;
use App\Enums\HoursAway;
use App\Enums\HouseholdMember;
use App\Enums\OtherPetType;
use App\Enums\OutdoorSpace;
use App\Enums\PetExperience;
use App\Enums\PreferredAgeGroup;
use App\Enums\PreferredSize;
use App\Enums\SpecialNeedsWillingness;
use App\Http\Controllers\Controller;
use App\Http\Resources\ErrorResource;
use App\Http\Resources\Profiles\HomeProfileResource;
use App\Http\Resources\ResponseResource;
use App\Models\HomeProfile;
use App\Services\ActivityLogs\ActivityLogger;
use App\Services\Matching\MatchScoreCalculator;
use App\Services\Uploads\FileUploadService;
use App\Support\Provinces;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Human Home Profile, 6-step lifestyle quiz, intro editor, and Open to Adopt toggle (BE-12, PR-11..PR-20).
 */
class HomeProfileController extends Controller
{
    public function __construct(
        private readonly FileUploadService $uploads,
        private readonly MatchScoreCalculator $matcher,
    ) {}

    public function show(Request $request)
    {
        $home = $request->user()->homeProfile;
        if (! $home) {
            return ErrorResource::notFound('Home Profile not found.')->toResponse($request);
        }

        return ResponseResource::make(
            (new HomeProfileResource($home))->forOwner()->toArray($request),
        );
    }

    public function updateStep(Request $request, ?string $step = null)
    {
        $user = $request->user();
        $home = $user->homeProfile;

        if (! $home) {
            return ErrorResource::notFound('Home Profile not found.')->toResponse($request);
        }

        $rules = $this->rulesForStep($step);
        $validated = $request->validate($rules);

        DB::transaction(function () use ($home, $validated, $step, $user, $request): void {
            foreach ([
                'about_home', 'home_type', 'outdoor_space', 'city', 'province',
                'activity_level', 'hours_away', 'pet_experience', 'special_needs_willingness',
            ] as $field) {
                if (array_key_exists($field, $validated)) {
                    $home->{$field} = $validated[$field];
                }
            }

            if (array_key_exists('is_open_to_adopt', $validated)) {
                $home->is_open_to_adopt = (bool) $validated['is_open_to_adopt'];
            }

            $home->save();

            if (array_key_exists('household_members', $validated)) {
                $home->householdMembers()->delete();
                foreach (array_values(array_unique($validated['household_members'])) as $member) {
                    $home->householdMembers()->create(['member' => $member]);
                }
            }

            if (array_key_exists('other_pets', $validated)) {
                $home->otherPets()->delete();
                foreach (array_values(array_unique($validated['other_pets'])) as $petType) {
                    $home->otherPets()->create(['pet_type' => $petType]);
                }
            }

            if (array_key_exists('accepted_species', $validated)) {
                $home->acceptedSpecies()->delete();
                foreach (array_values(array_unique($validated['accepted_species'])) as $species) {
                    $home->acceptedSpecies()->create(['species' => $species]);
                }
            }

            if (array_key_exists('preferred_sizes', $validated)) {
                $home->preferredSizes()->delete();
                foreach (array_values(array_unique($validated['preferred_sizes'])) as $size) {
                    $home->preferredSizes()->create(['size' => $size]);
                }
            }

            if (array_key_exists('preferred_ages', $validated)) {
                $home->preferredAges()->delete();
                foreach (array_values(array_unique($validated['preferred_ages'])) as $age) {
                    $home->preferredAges()->create(['age_group' => $age]);
                }
            }

            if ($step === '6' || $step === 'review' || $this->isQuizComplete($home->fresh())) {
                if ($home->quiz_completed_at === null) {
                    $home->quiz_completed_at = now();
                    $home->save();
                }
            }

            ActivityLogger::log(
                type: ActivityLogType::Profile,
                action: 'home_profile_updated',
                actor: $user,
                subject: $home,
                userAgent: $request->userAgent(),
            );
        });

        $home->refresh();
        if ($home->hasCompletedQuiz()) {
            $this->matcher->recalculateForHome($home);
        }

        return ResponseResource::make(
            (new HomeProfileResource($home))->forOwner()->toArray($request),
        );
    }

    public function updateIntro(Request $request)
    {
        $user = $request->user();
        $home = $user->homeProfile;

        if (! $home) {
            return ErrorResource::notFound('Home Profile not found.')->toResponse($request);
        }

        // full_name and birthdate are locked verified details (PR-12).
        $validated = $request->validate([
            'headline' => ['sometimes', 'nullable', 'string', 'max:140'],
            'about_home' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'profile_photo' => ['sometimes', 'nullable', 'file'],
            'cover_photo' => ['sometimes', 'nullable', 'file'],
        ]);

        if (array_key_exists('headline', $validated)) {
            $home->headline = $validated['headline'];
        }
        if (array_key_exists('about_home', $validated)) {
            $home->about_home = $validated['about_home'];
        }

        if ($request->hasFile('profile_photo') && $request->file('profile_photo') instanceof UploadedFile) {
            $stored = $this->uploads->storePublicPhoto($request->file('profile_photo'), 'homes/avatars', 'profile_photo');
            $home->profile_photo_path = $stored['file_path'];
        }

        if ($request->hasFile('cover_photo') && $request->file('cover_photo') instanceof UploadedFile) {
            $stored = $this->uploads->storePublicPhoto($request->file('cover_photo'), 'homes/covers', 'cover_photo');
            $home->cover_photo_path = $stored['file_path'];
        }

        $home->save();

        ActivityLogger::log(
            type: ActivityLogType::Profile,
            action: 'home_intro_updated',
            actor: $user,
            subject: $home,
            userAgent: $request->userAgent(),
        );

        return ResponseResource::make(
            (new HomeProfileResource($home->fresh()))->forOwner()->toArray($request),
        );
    }

    public function toggleOpenToAdopt(Request $request)
    {
        $user = $request->user();
        $home = $user->homeProfile;

        if (! $home) {
            return ErrorResource::notFound('Home Profile not found.')->toResponse($request);
        }

        $validated = $request->validate([
            'is_open_to_adopt' => ['required', 'boolean'],
        ]);

        $wantOpen = (bool) $validated['is_open_to_adopt'];

        if ($wantOpen && ! $home->hasCompletedQuiz()) {
            return ErrorResource::conflict(
                'Complete your Home Profile and lifestyle quiz before turning on Open to Adopt.',
                'quiz_incomplete',
            )->toResponse($request);
        }

        $before = $home->is_open_to_adopt ? 'open' : 'closed';
        $home->is_open_to_adopt = $wantOpen;
        $home->save();

        ActivityLogger::log(
            type: ActivityLogType::Profile,
            action: $wantOpen ? 'open_to_adopt_enabled' : 'open_to_adopt_disabled',
            actor: $user,
            subject: $home,
            before: $before,
            after: $wantOpen ? 'open' : 'closed',
            userAgent: $request->userAgent(),
        );

        if ($home->hasCompletedQuiz()) {
            $this->matcher->recalculateForHome($home);
        }

        return ResponseResource::make(
            (new HomeProfileResource($home->fresh()))->forOwner()->toArray($request),
        );
    }

    private function isQuizComplete(HomeProfile $home): bool
    {
        $home->loadMissing(['householdMembers', 'acceptedSpecies']);

        return filled($home->home_type)
            && filled($home->outdoor_space)
            && filled($home->activity_level)
            && filled($home->hours_away)
            && filled($home->pet_experience)
            && filled($home->special_needs_willingness)
            && $home->householdMembers->isNotEmpty()
            && $home->acceptedSpecies->isNotEmpty();
    }

    /**
     * @return array<string, mixed>
     */
    private function rulesForStep(?string $step): array
    {
        $householdRules = [
            'household_members' => ['required', 'array', 'min:1'],
            'household_members.*' => ['required', 'string', Rule::in(array_map(fn ($c) => $c->value, HouseholdMember::cases()))],
            'other_pets' => ['sometimes', 'array'],
            'other_pets.*' => ['required', 'string', Rule::in(array_map(fn ($c) => $c->value, OtherPetType::cases()))],
            'about_home' => ['sometimes', 'nullable', 'string', 'max:1000'],
        ];

        $homeSpaceRules = [
            'home_type' => ['required', 'string', Rule::in(array_map(fn ($c) => $c->value, HomeType::cases()))],
            'outdoor_space' => ['required', 'string', Rule::in(array_map(fn ($c) => $c->value, OutdoorSpace::cases()))],
            'city' => ['sometimes', 'required', 'string', 'max:80'],
            'province' => ['sometimes', 'required', 'string', Rule::in(Provinces::LIST)],
        ];

        $lifestyleRules = [
            'activity_level' => ['required', 'string', Rule::in(array_map(fn ($c) => $c->value, ActivityLevel::cases()))],
            'hours_away' => ['required', 'string', Rule::in(array_map(fn ($c) => $c->value, HoursAway::cases()))],
        ];

        $experienceRules = [
            'pet_experience' => ['required', 'string', Rule::in(array_map(fn ($c) => $c->value, PetExperience::cases()))],
            'special_needs_willingness' => ['required', 'string', Rule::in(array_map(fn ($c) => $c->value, SpecialNeedsWillingness::cases()))],
        ];

        $preferencesRules = [
            'accepted_species' => ['required', 'array', 'min:1'],
            'accepted_species.*' => ['required', 'string', Rule::in(array_map(fn ($c) => $c->value, AcceptedSpecies::cases()))],
            'preferred_sizes' => ['sometimes', 'array'],
            'preferred_sizes.*' => ['required', 'string', Rule::in(array_map(fn ($c) => $c->value, PreferredSize::cases()))],
            'preferred_ages' => ['sometimes', 'array'],
            'preferred_ages.*' => ['required', 'string', Rule::in(array_map(fn ($c) => $c->value, PreferredAgeGroup::cases()))],
        ];

        return match ($step) {
            '1', 'household' => $householdRules,
            '2', 'home-space' => $homeSpaceRules,
            '3', 'lifestyle' => $lifestyleRules,
            '4', 'experience' => $experienceRules,
            '5', 'preferences' => $preferencesRules,
            '6', 'review' => [
                'is_open_to_adopt' => ['sometimes', 'boolean'],
            ],
            default => array_map(
                fn (array $r) => array_values(array_unique(array_merge(['sometimes'], array_diff($r, ['required'])))),
                array_merge($householdRules, $homeSpaceRules, $lifestyleRules, $experienceRules, $preferencesRules, [
                    'is_open_to_adopt' => ['sometimes', 'boolean'],
                ]),
            ),
        };
    }
}
