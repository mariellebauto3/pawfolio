<?php

declare(strict_types=1);

namespace App\Http\Requests\Discovery;

use App\Support\Provinces;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * What the two Browse lists share (DS-01, DS-02): the search words, the place, the page, and filters that take
 * several values as one comma-separated value (`species=dog,cat`). Every filter is checked against an allow-list
 * (SEC-INPUT-01, SEC-INPUT-03); a value the list doesn't know is a 422, not a silent empty result.
 */
abstract class BrowseRequest extends FormRequest
{
    public const DEFAULT_PER_PAGE = 20;

    public const MAX_PER_PAGE = 50;

    public const SEARCH_MAX = 100;

    /** The most values one filter takes; every allow-list is shorter than this. */
    public const MAX_VALUES = 20;

    /**
     * Filters that take several values: name => the values allowed, or null for free text (temperament tags).
     *
     * @return array<string, list<string>|null>
     */
    abstract protected function listFilters(): array;

    /**
     * Filters that take one value: name => the values allowed.
     *
     * @return array<string, list<string>>
     */
    abstract protected function choiceFilters(): array;

    protected function prepareForValidation(): void
    {
        $merge = [];

        foreach (['q', 'province', 'city'] as $name) {
            if (is_string($this->query($name))) {
                $merge[$name] = trim($this->query($name));
            }
        }

        // "dog, cat," becomes ["dog", "cat"]; a list with nothing in it is no filter at all.
        foreach (array_keys($this->listFilters()) as $name) {
            if (is_string($this->query($name))) {
                $values = array_filter(array_map('trim', explode(',', $this->query($name))), fn (string $value) => $value !== '');
                $merge[$name] = array_values(array_unique($values));
            }
        }

        $this->merge($merge);
    }

    public function rules(): array
    {
        $rules = [
            'q' => ['sometimes', 'nullable', 'string', 'max:'.self::SEARCH_MAX],
            'province' => ['sometimes', 'nullable', 'string', Rule::in(Provinces::LIST)],
            'city' => ['sometimes', 'nullable', 'string', 'max:80'],
            'page' => ['sometimes', 'nullable', 'integer', 'min:1'],
        ];

        foreach ($this->listFilters() as $name => $allowed) {
            // `species=` arrives as null (ConvertEmptyStringsToNull): an empty value is no filter.
            $rules[$name] = ['sometimes', 'nullable', 'array', 'max:'.self::MAX_VALUES];
            $rules["{$name}.*"] = $allowed === null ? ['string', 'max:40'] : ['string', Rule::in($allowed)];
        }

        foreach ($this->choiceFilters() as $name => $allowed) {
            $rules[$name] = ['sometimes', 'nullable', 'string', Rule::in($allowed)];
        }

        return $rules;
    }

    public function messages(): array
    {
        $choose = 'Choose one of the listed options.';

        $messages = [
            'q.string' => 'Search for '.self::SEARCH_MAX.' characters or fewer.',
            'q.max' => 'Search for '.self::SEARCH_MAX.' characters or fewer.',
            'province.string' => 'Choose a province from the list.',
            'province.in' => 'Choose a province from the list.',
            'city.string' => 'Type a city of 80 characters or fewer.',
            'city.max' => 'Type a city of 80 characters or fewer.',
            'page.integer' => 'Choose a page number of 1 or more.',
            'page.min' => 'Choose a page number of 1 or more.',
        ];

        foreach (array_keys($this->listFilters()) as $name) {
            $messages["{$name}.array"] = $choose;
            $messages["{$name}.max"] = 'That is more than this filter takes.';
            $messages["{$name}.*.string"] = $choose;
            $messages["{$name}.*.in"] = $choose;
            $messages["{$name}.*.max"] = 'Keep each one to 40 characters or fewer.';
        }

        foreach (array_keys($this->choiceFilters()) as $name) {
            $messages["{$name}.string"] = $choose;
            $messages["{$name}.in"] = $choose;
        }

        return $messages;
    }

    /**
     * The values picked for a filter that takes several; empty when it isn't set.
     *
     * @return list<string>
     */
    public function picked(string $name): array
    {
        $values = $this->validated($name);

        return is_array($values) ? array_values($values) : [];
    }

    /** The value of a one-value filter or a text one; null when it isn't set. */
    public function chosen(string $name): ?string
    {
        $value = $this->validated($name);

        return is_string($value) && $value !== '' ? $value : null;
    }

    /** As every list: 20 a page unless asked, never more than 50 (SEC-API-05). */
    public function perPage(): int
    {
        return min(max((int) $this->query('per_page', (string) self::DEFAULT_PER_PAGE), 1), self::MAX_PER_PAGE);
    }
}
