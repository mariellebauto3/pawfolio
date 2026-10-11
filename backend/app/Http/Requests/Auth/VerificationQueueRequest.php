<?php

declare(strict_types=1);

namespace App\Http\Requests\Auth;

use App\Enums\Role;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Filters of the admin verification queue (AU-22). The order is fixed (newest first), so there is no sort to list.
 */
class VerificationQueueRequest extends FormRequest
{
    public const DEFAULT_PER_PAGE = 20;

    public const MAX_PER_PAGE = 50;

    public const SEARCH_MAX = 100;

    /** Admin only: the route's `role:admin` middleware has already checked (SEC-AUTHZ-07). */
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->query('search'))) {
            $this->merge(['search' => trim($this->query('search'))]);
        }
    }

    public function rules(): array
    {
        return [
            // Allow-list (SEC-INPUT-03).
            'role' => ['sometimes', 'nullable', 'string', Rule::in([Role::Pet->value, Role::Human->value])],
            'search' => ['sometimes', 'nullable', 'string', 'max:'.self::SEARCH_MAX],
        ];
    }

    public function messages(): array
    {
        return [
            'role.string' => 'Choose Pet or Human.',
            'role.in' => 'Choose Pet or Human.',
            'search.string' => 'Search for '.self::SEARCH_MAX.' characters or fewer.',
            'search.max' => 'Search for '.self::SEARCH_MAX.' characters or fewer.',
        ];
    }

    public function role(): ?string
    {
        return $this->validated('role') ?: null;
    }

    public function search(): ?string
    {
        return $this->validated('search') ?: null;
    }

    /** As every list: 20 a page unless asked, never more than 50 (SEC-API-05). */
    public function perPage(): int
    {
        return min(max((int) $this->query('per_page', (string) self::DEFAULT_PER_PAGE), 1), self::MAX_PER_PAGE);
    }
}
