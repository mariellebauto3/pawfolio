<?php

declare(strict_types=1);

namespace App\Http\Requests\AdoptionRequests;

use App\Models\Invite;
use Illuminate\Foundation\Http\FormRequest;

/**
 * The page asked of `GET /invites` (RQ-02, docs/api/bookmarks-and-invites.md). There is nothing to filter: the list is
 * the pet's own invites that it hasn't dismissed.
 */
class ListInvitesRequest extends FormRequest
{
    public const DEFAULT_PER_PAGE = 20;

    public const MAX_PER_PAGE = 50;

    /** Only the pet reads its invites (InvitePolicy); the route's middleware has checked signed-in and Active. */
    public function authorize(): bool
    {
        return $this->user()?->can('viewAny', Invite::class) ?? false;
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
