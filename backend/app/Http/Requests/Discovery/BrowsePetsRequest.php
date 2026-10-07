<?php

declare(strict_types=1);

namespace App\Http\Requests\Discovery;

use App\Enums\AcceptedSpecies;
use App\Enums\PetEnergyLevel;
use App\Enums\PetSex;
use App\Enums\PetSize;
use App\Enums\PetStatus;
use App\Models\Pet;

/**
 * Filters and sort of Browse pets (DS-01, FR6, docs/api/discovery.md).
 */
class BrowsePetsRequest extends BrowseRequest
{
    /** Age groups by the pet's age in months. `baby` and `young` are older names the API still reads. */
    public const AGE_GROUPS = ['puppy_kitten', 'adult', 'senior', 'baby', 'young'];

    public const SORTS = ['best_match', 'newest', 'name_asc'];

    /** Any Active account may browse (PetPolicy); the route's middleware has checked signed-in and Active too. */
    public function authorize(): bool
    {
        return $this->user()?->can('viewAny', Pet::class) ?? false;
    }

    protected function listFilters(): array
    {
        return [
            'species' => array_column(AcceptedSpecies::cases(), 'value'),
            'size' => array_column(PetSize::cases(), 'value'),
            'sex' => array_column(PetSex::cases(), 'value'),
            'energy_level' => array_column(PetEnergyLevel::cases(), 'value'),
            'age' => self::AGE_GROUPS,
            'good_with' => ['kids', 'dogs', 'cats'],
            // Tags are the caretaker's own words (PR-05), so there is no list to check them against.
            'temperament' => null,
        ];
    }

    protected function choiceFilters(): array
    {
        return [
            'special_needs' => ['none', 'any'],
            'sort' => self::SORTS,
            // Only the two statuses a listed pet can have: Drafts and adopted pets are never browsed (§5.2).
            'status' => [PetStatus::LookingForAHome->value, PetStatus::InProcess->value],
        ];
    }

    public function sort(): string
    {
        return $this->chosen('sort') ?? 'best_match';
    }

    public function status(): string
    {
        return $this->chosen('status') ?? PetStatus::LookingForAHome->value;
    }
}
