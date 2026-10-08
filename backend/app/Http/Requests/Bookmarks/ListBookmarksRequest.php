<?php

declare(strict_types=1);

namespace App\Http\Requests\Bookmarks;

use App\Models\Bookmark;
use Illuminate\Foundation\Http\FormRequest;

/**
 * The page asked of `GET /bookmarks` (BM-01, BM-02, docs/api/bookmarks-and-invites.md). There is nothing to filter:
 * a human's bookmarks are pets and a pet's are homes.
 */
class ListBookmarksRequest extends FormRequest
{
    public const DEFAULT_PER_PAGE = 20;

    public const MAX_PER_PAGE = 50;

    public function authorize(): bool
    {
        return $this->user()?->can('viewAny', Bookmark::class) ?? false;
    }

    public function rules(): array
    {
        return [
            'page' => ['sometimes', 'nullable', 'integer', 'min:1'],
        ];
    }

    public function messages(): array
    {
        return [
            'page.integer' => 'Choose a page number of 1 or more.',
            'page.min' => 'Choose a page number of 1 or more.',
        ];
    }

    /** As every list: 20 a page unless asked, never more than 50 (SEC-API-05). */
    public function perPage(): int
    {
        return min(max((int) $this->query('per_page', (string) self::DEFAULT_PER_PAGE), 1), self::MAX_PER_PAGE);
    }
}
