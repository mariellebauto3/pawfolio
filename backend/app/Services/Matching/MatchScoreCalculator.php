<?php

declare(strict_types=1);

namespace App\Services\Matching;

use App\Enums\PetGoodWith;
use App\Enums\PetStatus;
use App\Models\HomeProfile;
use App\Models\MatchScore;
use App\Models\Pet;

/**
 * Deterministic 2-step compatibility scoring engine (BE-13, Proposal §6, MT-01..MT-03).
 *
 * Step 1 — Dealbreakers:
 *   1. Species accepted by the human
 *   2. Kids compatibility (if household has kids_under_6 or kids_6_to_12, pet good_with_kids != 'no')
 *   3. Other pets compatibility (if home has dogs -> good_with_dogs != 'no'; if cats -> good_with_cats != 'no')
 *   4. Same province
 *
 * Step 2 — 7 Weighted Criteria (total <= 100):
 *   1. Activity level ↔ energy level (20)
 *   2. Hours away ↔ time alone (15)
 *   3. Home type & outdoor space ↔ space needs (15)
 *   4. Pet experience ↔ experience needed (15)
 *   5. Preferred size & age ↔ size & age (15)
 *   6. Kids & other pets ↔ compatibility tags (10)
 *   7. Special needs ↔ medical care (10)
 */
class MatchScoreCalculator
{
    /**
     * Evaluate dealbreakers and weighted points for a (Pet, HomeProfile) pair.
     *
     * @return array{
     *   passes_dealbreakers: bool,
     *   dealbreakers: array{species_accepted: bool, ok_with_kids: bool, ok_with_other_pets: bool, same_province: bool},
     *   score: int,
     *   activity_points: int,
     *   hours_away_points: int,
     *   space_points: int,
     *   experience_points: int,
     *   size_age_points: int,
     *   compatibility_points: int,
     *   special_needs_points: int,
     *   criteria: list<array{key: string, label: string, points: int, max_points: int}>,
     *   reasons: list<string>
     * }
     */
    public function evaluate(Pet $pet, HomeProfile $home): array
    {
        $pet->loadMissing(['specialNeeds', 'temperamentTags', 'skills']);
        $home->loadMissing(['householdMembers', 'otherPets', 'acceptedSpecies', 'preferredSizes', 'preferredAges']);

        $dealbreakers = $this->checkDealbreakers($pet, $home);
        $passes = $dealbreakers['species_accepted']
            && $dealbreakers['ok_with_kids']
            && $dealbreakers['ok_with_other_pets']
            && $dealbreakers['same_province'];

        $activityPoints = $this->scoreActivity($pet, $home);
        $hoursAwayPoints = $this->scoreHoursAway($pet, $home);
        $spacePoints = $this->scoreSpace($pet, $home);
        $experiencePoints = $this->scoreExperience($pet, $home);
        $sizeAgePoints = $this->scoreSizeAndAge($pet, $home);
        $compatibilityPoints = $this->scoreCompatibility($pet, $home);
        $specialNeedsPoints = $this->scoreSpecialNeeds($pet, $home);

        $total = min(
            100,
            $activityPoints
            + $hoursAwayPoints
            + $spacePoints
            + $experiencePoints
            + $sizeAgePoints
            + $compatibilityPoints
            + $specialNeedsPoints,
        );

        $criteria = [
            [
                'key' => 'activity',
                'label' => 'Activity level ↔ energy level',
                'points' => $activityPoints,
                'max_points' => 20,
            ],
            [
                'key' => 'hours_away',
                'label' => 'Hours away ↔ time it can be left alone',
                'points' => $hoursAwayPoints,
                'max_points' => 15,
            ],
            [
                'key' => 'space',
                'label' => 'Home type & outdoor space ↔ space needs',
                'points' => $spacePoints,
                'max_points' => 15,
            ],
            [
                'key' => 'experience',
                'label' => 'Pet experience ↔ experience it needs',
                'points' => $experiencePoints,
                'max_points' => 15,
            ],
            [
                'key' => 'size_age',
                'label' => 'Preferred size & age ↔ size & age',
                'points' => $sizeAgePoints,
                'max_points' => 15,
            ],
            [
                'key' => 'compatibility',
                'label' => 'Kids & other pets ↔ compatibility tags',
                'points' => $compatibilityPoints,
                'max_points' => 10,
            ],
            [
                'key' => 'special_needs',
                'label' => 'Special needs ↔ medical care',
                'points' => $specialNeedsPoints,
                'max_points' => 10,
            ],
        ];

        $reasons = $this->buildReasons($pet, $home, [
            'activity' => $activityPoints,
            'hours_away' => $hoursAwayPoints,
            'space' => $spacePoints,
            'experience' => $experiencePoints,
            'size_age' => $sizeAgePoints,
            'compatibility' => $compatibilityPoints,
            'special_needs' => $specialNeedsPoints,
        ]);

        $failedDealbreakers = [];
        foreach ($dealbreakers as $dbKey => $dbPassed) {
            if (! $dbPassed) {
                $failedDealbreakers[] = $dbKey;
            }
        }

        return [
            'passes_dealbreakers' => $passes,
            'passed_dealbreakers' => $passes,
            'failed_dealbreakers' => $failedDealbreakers,
            'dealbreakers' => $dealbreakers,
            'score' => $passes ? $total : 0,
            'activity_points' => $activityPoints,
            'hours_away_points' => $hoursAwayPoints,
            'space_points' => $spacePoints,
            'experience_points' => $experiencePoints,
            'size_age_points' => $sizeAgePoints,
            'compatibility_points' => $compatibilityPoints,
            'special_needs_points' => $specialNeedsPoints,
            'criteria' => $criteria,
            'criteria_scores' => $criteria,
            'reasons' => $reasons,
        ];
    }

    public function upsertPair(Pet $pet, HomeProfile $home): ?MatchScore
    {
        return $this->persistPair($pet, $home);
    }

    /**
     * Recalculate and persist match_scores for one Pet across all quiz-completed Home Profiles.
     */
    public function recalculateForPet(Pet $pet): void
    {
        $status = $pet->getStatusEnum();
        if (! in_array($status, [PetStatus::LookingForAHome, PetStatus::InProcess], true)) {
            MatchScore::where('pet_id', $pet->id)->delete();

            return;
        }

        $pet->load(['specialNeeds', 'temperamentTags', 'skills']);

        $homes = HomeProfile::query()
            ->whereNotNull('quiz_completed_at')
            ->with(['householdMembers', 'otherPets', 'acceptedSpecies', 'preferredSizes', 'preferredAges'])
            ->get();

        foreach ($homes as $home) {
            $this->persistPair($pet, $home);
        }
    }

    /**
     * Recalculate and persist match_scores for one HomeProfile across all published Pets.
     */
    public function recalculateForHome(HomeProfile $home): void
    {
        if (! $home->hasCompletedQuiz()) {
            MatchScore::where('home_profile_id', $home->id)->delete();

            return;
        }

        $home->load(['householdMembers', 'otherPets', 'acceptedSpecies', 'preferredSizes', 'preferredAges']);

        $pets = Pet::query()
            ->whereIn('status', [PetStatus::LookingForAHome->value, PetStatus::InProcess->value])
            ->with(['specialNeeds', 'temperamentTags', 'skills'])
            ->get();

        foreach ($pets as $pet) {
            $this->persistPair($pet, $home);
        }
    }

    public function persistPair(Pet $pet, HomeProfile $home): ?MatchScore
    {
        $result = $this->evaluate($pet, $home);

        if (! $result['passes_dealbreakers']) {
            MatchScore::where('pet_id', $pet->id)
                ->where('home_profile_id', $home->id)
                ->delete();

            return null;
        }

        $row = MatchScore::firstOrNew([
            'pet_id' => $pet->id,
            'home_profile_id' => $home->id,
        ]);

        $row->pet_id = $pet->id;
        $row->home_profile_id = $home->id;
        $row->score = $result['score'];
        $row->activity_points = $result['activity_points'];
        $row->hours_away_points = $result['hours_away_points'];
        $row->space_points = $result['space_points'];
        $row->experience_points = $result['experience_points'];
        $row->size_age_points = $result['size_age_points'];
        $row->compatibility_points = $result['compatibility_points'];
        $row->special_needs_points = $result['special_needs_points'];
        $row->calculated_at = now();
        $row->save();

        return $row;
    }

    /**
     * @return array{species_accepted: bool, ok_with_kids: bool, ok_with_other_pets: bool, same_province: bool}
     */
    private function checkDealbreakers(Pet $pet, HomeProfile $home): array
    {
        $acceptedSpecies = $home->acceptedSpecies
            ->map(fn ($row) => $row->species instanceof \BackedEnum ? $row->species->value : (string) $row->species)
            ->all();

        $speciesAccepted = ! empty($acceptedSpecies) && in_array((string) $pet->species, $acceptedSpecies, true);

        $members = $home->householdMembers
            ->map(fn ($row) => $row->member instanceof \BackedEnum ? $row->member->value : (string) $row->member)
            ->all();

        $hasKids = in_array('kids_under_6', $members, true) || in_array('kids_6_to_12', $members, true);
        $goodWithKids = $pet->good_with_kids instanceof PetGoodWith
            ? $pet->good_with_kids->value
            : (string) $pet->good_with_kids;
        $okWithKids = ! $hasKids || $goodWithKids !== PetGoodWith::No->value;

        $otherPets = $home->otherPets
            ->map(fn ($row) => $row->pet_type instanceof \BackedEnum ? $row->pet_type->value : (string) $row->pet_type)
            ->all();

        $goodWithDogs = $pet->good_with_dogs instanceof PetGoodWith
            ? $pet->good_with_dogs->value
            : (string) $pet->good_with_dogs;
        $goodWithCats = $pet->good_with_cats instanceof PetGoodWith
            ? $pet->good_with_cats->value
            : (string) $pet->good_with_cats;

        $okWithDogs = ! in_array('dogs', $otherPets, true) || $goodWithDogs !== PetGoodWith::No->value;
        $okWithCats = ! in_array('cats', $otherPets, true) || $goodWithCats !== PetGoodWith::No->value;
        $okWithOtherPets = $okWithDogs && $okWithCats;

        $petProvince = mb_strtolower(trim((string) $pet->province));
        $homeProvince = mb_strtolower(trim((string) $home->province));
        $sameProvince = $petProvince !== '' && $petProvince === $homeProvince;

        return [
            'species_accepted' => $speciesAccepted,
            'ok_with_kids' => $okWithKids,
            'ok_with_other_pets' => $okWithOtherPets,
            'same_province' => $sameProvince,
        ];
    }

    private function scoreActivity(Pet $pet, HomeProfile $home): int
    {
        $energy = $pet->energy_level instanceof \BackedEnum ? $pet->energy_level->value : (string) $pet->energy_level;
        $activity = (string) $home->activity_level;

        if ($energy === '' || $activity === '') {
            return 12;
        }

        $petLevel = match ($energy) {
            'low' => 1,
            'medium' => 2,
            'high' => 3,
            default => 2,
        };

        $homeLevel = match ($activity) {
            'relaxed' => 1,
            'moderate' => 2,
            'active', 'very_active' => 3,
            default => 2,
        };

        $diff = abs($petLevel - $homeLevel);

        return match ($diff) {
            0 => 20,
            1 => 14,
            default => 6,
        };
    }

    private function scoreHoursAway(Pet $pet, HomeProfile $home): int
    {
        $timeAlone = $pet->time_alone instanceof \BackedEnum ? $pet->time_alone->value : (string) $pet->time_alone;
        $hoursAway = (string) $home->hours_away;

        if ($timeAlone === '' || $hoursAway === '') {
            return 10;
        }

        $petMaxHours = match ($timeAlone) {
            'up_to_2_hrs' => 2,
            'up_to_4_hrs' => 4,
            'up_to_6_hrs' => 6,
            '8_plus_hrs' => 10,
            default => 6,
        };

        $homeAwayHours = match ($hoursAway) {
            '0_to_2' => 2,
            '3_to_5' => 4,
            '6_to_8' => 6,
            '9_plus' => 9,
            default => 5,
        };

        if ($petMaxHours >= $homeAwayHours) {
            return 15;
        }

        if ($homeAwayHours - $petMaxHours <= 2) {
            return 10;
        }

        return 4;
    }

    private function scoreSpace(Pet $pet, HomeProfile $home): int
    {
        $spaceNeeds = $pet->space_needs instanceof \BackedEnum ? $pet->space_needs->value : (string) $pet->space_needs;
        $homeType = (string) $home->home_type;
        $outdoor = (string) $home->outdoor_space;
        $activity = (string) $home->activity_level;

        if ($spaceNeeds === '' || $spaceNeeds === 'apartment_ok') {
            return 15;
        }

        $hasYard = in_array($outdoor, ['small_yard', 'large_yard'], true);
        $isGroundHome = in_array($homeType, ['house', 'townhouse'], true);
        $isActive = in_array($activity, ['active', 'very_active'], true);

        if ($spaceNeeds === 'ground_floor') {
            return ($isGroundHome || $hasYard) ? 15 : 9;
        }

        // needs_yard_or_daily_walks
        if ($hasYard || ($isGroundHome && $isActive)) {
            return 15;
        }

        if ($isActive || $isGroundHome) {
            return 11;
        }

        return 5;
    }

    private function scoreExperience(Pet $pet, HomeProfile $home): int
    {
        $needed = $pet->experience_needed instanceof \BackedEnum ? $pet->experience_needed->value : (string) $pet->experience_needed;
        $experience = (string) $home->pet_experience;

        $neededRank = match ($needed) {
            'first_time_ok', '' => 1,
            'some_experience' => 2,
            'experienced_only' => 3,
            default => 1,
        };

        $homeRank = match ($experience) {
            'first_time' => 1,
            'some' => 2,
            'experienced' => 3,
            default => 2,
        };

        if ($homeRank >= $neededRank) {
            return 15;
        }

        if ($neededRank - $homeRank === 1) {
            return 8;
        }

        return 2;
    }

    private function scoreSizeAndAge(Pet $pet, HomeProfile $home): int
    {
        $petSize = $pet->size instanceof \BackedEnum ? $pet->size->value : (string) $pet->size;
        $preferredSizes = $home->preferredSizes
            ->map(fn ($row) => $row->size instanceof \BackedEnum ? $row->size->value : (string) $row->size)
            ->all();

        $sizePts = (empty($preferredSizes) || ($petSize !== '' && in_array($petSize, $preferredSizes, true))) ? 8 : 3;

        $months = (int) ($pet->approximate_age_months ?? 24);
        $ageGroup = self::ageGroupForMonths($months);

        $preferredAges = $home->preferredAges
            ->map(fn ($row) => $row->age_group instanceof \BackedEnum ? $row->age_group->value : (string) $row->age_group)
            ->all();

        $agePts = (empty($preferredAges) || in_array($ageGroup, $preferredAges, true)) ? 7 : 3;

        return $sizePts + $agePts;
    }

    private function scoreCompatibility(Pet $pet, HomeProfile $home): int
    {
        $points = 10;

        $members = $home->householdMembers
            ->map(fn ($row) => $row->member instanceof \BackedEnum ? $row->member->value : (string) $row->member)
            ->all();
        $hasKids = in_array('kids_under_6', $members, true) || in_array('kids_6_to_12', $members, true);

        $otherPets = $home->otherPets
            ->map(fn ($row) => $row->pet_type instanceof \BackedEnum ? $row->pet_type->value : (string) $row->pet_type)
            ->all();

        $kidsVal = $pet->good_with_kids instanceof PetGoodWith ? $pet->good_with_kids->value : (string) $pet->good_with_kids;
        $dogsVal = $pet->good_with_dogs instanceof PetGoodWith ? $pet->good_with_dogs->value : (string) $pet->good_with_dogs;
        $catsVal = $pet->good_with_cats instanceof PetGoodWith ? $pet->good_with_cats->value : (string) $pet->good_with_cats;

        if ($hasKids && $kidsVal !== PetGoodWith::Yes->value) {
            $points -= 3;
        }
        if (in_array('dogs', $otherPets, true) && $dogsVal !== PetGoodWith::Yes->value) {
            $points -= 3;
        }
        if (in_array('cats', $otherPets, true) && $catsVal !== PetGoodWith::Yes->value) {
            $points -= 3;
        }

        return max(2, min(10, $points));
    }

    private function scoreSpecialNeeds(Pet $pet, HomeProfile $home): int
    {
        $needs = $pet->specialNeeds
            ->map(fn ($row) => $row->need instanceof \BackedEnum ? $row->need->value : (string) $row->need)
            ->all();

        if (empty($needs)) {
            return 10;
        }

        $willingness = (string) $home->special_needs_willingness;

        return match ($willingness) {
            'yes' => 10,
            'minor_needs_only' => in_array('mobility_support', $needs, true) ? 4 : 8,
            default => 2,
        };
    }

    /**
     * Up to three sentences on why the pair fits. The pet and the human read the same ones (one score, both
     * directions, MT-02), so they name "the pet" and "the home" and never say "you".
     *
     * @param  array<string, int>  $points
     * @return list<string>
     */
    private function buildReasons(Pet $pet, HomeProfile $home, array $points): array
    {
        $reasons = [];

        if ($points['activity'] >= 14) {
            $energy = $pet->energy_level instanceof \BackedEnum ? $pet->energy_level->value : (string) $pet->energy_level;
            $reasons[] = match ($energy) {
                'high' => 'An active home for a high-energy pet',
                'low' => 'A calm home for a low-energy pet',
                default => 'The home’s activity level fits the pet’s energy',
            };
        }

        if ($points['hours_away'] >= 12) {
            $reasons[] = 'The pet is fine alone for the hours the home is empty';
        }

        if ($points['space'] >= 13) {
            $reasons[] = 'The home and its outdoor space fit the pet’s space needs';
        }

        if ($points['compatibility'] >= 9) {
            $reasons[] = 'The pet gets along with the household and its other pets';
        }

        if ($points['experience'] >= 13 && count($reasons) < 3) {
            $reasons[] = 'The home has the experience the pet needs';
        }

        if ($points['special_needs'] >= 8 && $pet->specialNeeds->isNotEmpty() && count($reasons) < 3) {
            $reasons[] = 'The home is open to the special care the pet needs';
        }

        if (empty($reasons)) {
            $reasons[] = 'Both are in '.$pet->province.', and the home accepts this species';
        }

        return array_slice($reasons, 0, 3);
    }

    public static function ageGroupForMonths(int $months): string
    {
        if ($months <= 12) {
            return 'puppy_kitten';
        }

        if ($months >= 84) {
            return 'senior';
        }

        return 'adult';
    }
}
