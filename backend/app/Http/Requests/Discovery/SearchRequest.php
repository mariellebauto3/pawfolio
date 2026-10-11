<?php

declare(strict_types=1);

namespace App\Http\Requests\Discovery;

use App\Models\Pet;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * The top-bar search (GN-01, DS-03, docs/api/discovery.md): the words, and optionally one kind of result to page
 * through.
 */
class SearchRequest extends FormRequest
{
    public const TYPES = ['pets', 'home_profiles', 'posts'];

    public const SEARCH_MAX = 100;

    /** How many of each kind the overview holds unless asked, and the most it holds. */
    public const DEFAULT_LIMIT = 10;

    public const MAX_LIMIT = 25;

    public const DEFAULT_PER_PAGE = 20;

    public const MAX_PER_PAGE = 50;

    /** Any Active account may search; the route's middleware has checked signed-in and Active too. */
    public function authorize(): bool
    {
        return $this->user()?->can('viewAny', Pet::class) ?? false;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->query('q'))) {
            $this->merge(['q' => trim($this->query('q'))]);
        }
    }

    public function rules(): array
    {
        return [
            'q' => ['sometimes', 'nullable', 'string', 'max:'.self::SEARCH_MAX],
            // Allow-list (SEC-INPUT-03).
            'type' => ['sometimes', 'nullable', 'string', Rule::in(self::TYPES)],
            'page' => ['sometimes', 'nullable', 'integer', 'min:1'],
        ];
    }

    public function messages(): array
    {
        return [
            'q.string' => 'Search for '.self::SEARCH_MAX.' characters or fewer.',
            'q.max' => 'Search for '.self::SEARCH_MAX.' characters or fewer.',
            'type.string' => 'Choose pets, home_profiles or posts.',
            'type.in' => 'Choose pets, home_profiles or posts.',
            'page.integer' => 'Choose a page number of 1 or more.',
            'page.min' => 'Choose a page number of 1 or more.',
        ];
    }

    /** What to look for; empty when nothing was typed. */
    public function words(): string
    {
        return (string) ($this->validated('q') ?? '');
    }

    /** The one kind to page through, or null for the overview of all three. */
    public function type(): ?string
    {
        return $this->validated('type') ?: null;
    }

    /** How many of each kind the overview holds: 10 unless asked, never more than 25. */
    public function limit(): int
    {
        return min(max((int) $this->query('limit', (string) self::DEFAULT_LIMIT), 1), self::MAX_LIMIT);
    }

    /** As every list: 20 a page unless asked, never more than 50 (SEC-API-05). */
    public function perPage(): int
    {
        return min(max((int) $this->query('per_page', (string) self::DEFAULT_PER_PAGE), 1), self::MAX_PER_PAGE);
    }
}
