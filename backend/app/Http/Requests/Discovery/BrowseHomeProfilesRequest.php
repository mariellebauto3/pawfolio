<?php

declare(strict_types=1);

namespace App\Http\Requests\Discovery;

use App\Enums\AcceptedSpecies;
use App\Enums\ActivityLevel;
use App\Enums\HomeType;
use App\Enums\OtherPetType;
use App\Enums\OutdoorSpace;
use App\Enums\PetExperience;
use App\Enums\PreferredSize;
use App\Models\HomeProfile;

/**
 * Filters and sort of Browse homes (DS-02, FR22, docs/api/discovery.md).
 */
class BrowseHomeProfilesRequest extends BrowseRequest
{
    public const SORTS = ['best_match', 'newest'];

    /** Any Active account may browse (HomeProfilePolicy); the route's middleware has checked signed-in and Active too. */
    public function authorize(): bool
    {
        return $this->user()?->can('viewAny', HomeProfile::class) ?? false;
    }

    protected function listFilters(): array
    {
        return [
            'home_type' => array_column(HomeType::cases(), 'value'),
            'outdoor_space' => array_column(OutdoorSpace::cases(), 'value'),
            'activity_level' => array_column(ActivityLevel::cases(), 'value'),
            'pet_experience' => array_column(PetExperience::cases(), 'value'),
            'accepted_species' => array_column(AcceptedSpecies::cases(), 'value'),
            'preferred_size' => array_column(PreferredSize::cases(), 'value'),
            // "none" for no other pets, or the kinds of pet the home has.
            'has_other_pets' => ['none', ...array_column(OtherPetType::cases(), 'value')],
        ];
    }

    protected function choiceFilters(): array
    {
        return [
            'has_kids' => ['yes', 'no'],
            'search_in' => self::SEARCH_IN,
            'sort' => self::SORTS,
        ];
    }

    public function sort(): string
    {
        return $this->chosen('sort') ?? 'best_match';
    }
}
