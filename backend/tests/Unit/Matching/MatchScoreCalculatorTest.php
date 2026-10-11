<?php

declare(strict_types=1);

namespace Tests\Unit\Matching;

use App\Enums\ActivityLevel;
use App\Enums\HoursAway;
use App\Enums\OutdoorSpace;
use App\Enums\PetEnergyLevel;
use App\Enums\PetExperience;
use App\Enums\PetExperienceNeeded;
use App\Enums\PetGoodWith;
use App\Enums\PetSize;
use App\Enums\PetSpaceNeeds;
use App\Enums\PetTimeAlone;
use App\Enums\SpecialNeedsWillingness;
use App\Models\HomeProfile;
use App\Models\Pet;
use App\Services\Matching\MatchScoreCalculator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MatchScoreCalculatorTest extends TestCase
{
    use RefreshDatabase;

    public function test_dealbreakers_and_7_weighted_criteria_sum_to_100(): void
    {
        $calculator = new MatchScoreCalculator;

        $pet = Pet::factory()->lookingForAHome()->create([
            'species' => 'dog',
            'approximate_age_months' => 24,
            'size' => PetSize::Medium,
            'province' => 'Metro Manila',
            'energy_level' => PetEnergyLevel::Medium,
            'good_with_kids' => PetGoodWith::Yes,
            'good_with_dogs' => PetGoodWith::Yes,
            'good_with_cats' => PetGoodWith::Yes,
            'time_alone' => PetTimeAlone::UpTo4Hrs,
            'space_needs' => PetSpaceNeeds::NeedsYardOrDailyWalks,
            'experience_needed' => PetExperienceNeeded::ExperiencedOnly,
        ]);

        $home = HomeProfile::factory()->openToAdopt()->create([
            'province' => 'Metro Manila',
            'outdoor_space' => OutdoorSpace::SmallYard->value,
            'activity_level' => ActivityLevel::Moderate->value,
            'hours_away' => HoursAway::ThreeToFive->value,
            'pet_experience' => PetExperience::Experienced->value,
            'special_needs_willingness' => SpecialNeedsWillingness::Yes->value,
        ]);
        $home->acceptedSpecies()->create(['species' => 'dog']);
        $home->preferredSizes()->create(['size' => 'medium']);
        $home->preferredAges()->create(['age_group' => 'adult']);
        $home->householdMembers()->create(['member' => 'kids_6_to_12']);
        $home->otherPets()->create(['pet_type' => 'dogs']);

        $result = $calculator->evaluate($pet, $home);
        $this->assertTrue($result['passes_dealbreakers']);
        $this->assertSame(100, $result['score']);
        $this->assertCount(7, $result['criteria']);

        // Dealbreaker 1: Different province fails.
        $homeDiffProvince = HomeProfile::factory()->openToAdopt()->create([
            'province' => 'Cebu',
        ]);
        $homeDiffProvince->acceptedSpecies()->create(['species' => 'dog']);
        $resProvince = $calculator->evaluate($pet, $homeDiffProvince);
        $this->assertFalse($resProvince['passes_dealbreakers']);
        $this->assertContains('same_province', $resProvince['failed_dealbreakers']);

        // Dealbreaker 2: Pet not good with kids when household has kids fails.
        $petNoKids = Pet::factory()->lookingForAHome()->create([
            'species' => 'dog',
            'province' => 'Metro Manila',
            'good_with_kids' => PetGoodWith::No,
        ]);
        $resKids = $calculator->evaluate($petNoKids, $home);
        $this->assertFalse($resKids['passes_dealbreakers']);
        $this->assertContains('ok_with_kids', $resKids['failed_dealbreakers']);
    }
}
