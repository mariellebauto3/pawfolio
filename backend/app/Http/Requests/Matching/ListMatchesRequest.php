<?php

declare(strict_types=1);

namespace App\Http\Requests\Matching;

use App\Enums\AcceptedSpecies;
use App\Enums\HomeType;
use App\Enums\OtherPetType;
use App\Enums\PetSize;
use App\Http\Requests\Discovery\BrowseRequest;
use Illuminate\Support\Arr;

/**
 * Quick filters and sort of Pets for You and Homes for You (MT-01, MT-02, docs/api/profiles-and-matching.md).
 *
 * Read the way the Browse lists read theirs: a list travels as one comma-separated value, and every value is checked
 * against an allow-list, so one the list doesn't know is a 422 instead of a silent empty result (SEC-INPUT-01,
 * SEC-INPUT-03). A filter of the other side's list (a pet sending `species`) is checked too and then left unused.
 */
class ListMatchesRequest extends BrowseRequest
{
    public const AGE_GROUPS = ['puppy_kitten', 'adult', 'senior'];

    public const SORTS = ['best_match', 'newest'];

    public const TIERS = ['high', 'medium', 'low'];

    /** Only a pet and a human have matches; the route's middleware has checked signed-in and Active (SEC-AUTHZ-01). */
    public function authorize(): bool
    {
        $user = $this->user();

        return $user !== null && ($user->isPet() || $user->isHuman());
    }

    protected function listFilters(): array
    {
        return [
            // Pets for You.
            'species' => array_column(AcceptedSpecies::cases(), 'value'),
            'size' => array_column(PetSize::cases(), 'value'),
            'age' => self::AGE_GROUPS,
            // Homes for You. "none" for no other pets, or the kinds of pet the home has.
            'home_type' => array_column(HomeType::cases(), 'value'),
            'has_other_pets' => ['none', ...array_column(OtherPetType::cases(), 'value')],
        ];
    }

    protected function choiceFilters(): array
    {
        return [
            'has_kids' => ['yes', 'no'],
            'sort' => self::SORTS,
            'tier' => self::TIERS,
        ];
    }

    public function rules(): array
    {
        // Matches are never searched by words, and they are in the viewer's own province by rule.
        return Arr::except(parent::rules(), ['q', 'province']) + [
            'min_score' => ['sometimes', 'nullable', 'integer', 'between:0,100'],
            'max_score' => ['sometimes', 'nullable', 'integer', 'between:0,100'],
        ];
    }

    public function messages(): array
    {
        $score = 'Choose a score from 0 to 100.';

        return parent::messages() + [
            'min_score.integer' => $score,
            'min_score.between' => $score,
            'max_score.integer' => $score,
            'max_score.between' => $score,
        ];
    }

    public function sort(): string
    {
        return $this->chosen('sort') ?? 'best_match';
    }

    /** A score bound from `min_score` or `max_score`; null when it isn't set. */
    public function score(string $name): ?int
    {
        $value = $this->validated($name);

        return $value === null || $value === '' ? null : (int) $value;
    }
}
