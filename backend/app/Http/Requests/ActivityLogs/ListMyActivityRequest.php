<?php

declare(strict_types=1);

namespace App\Http\Requests\ActivityLogs;

use App\Enums\ActivityLogType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * What may be asked of `GET /activity` and its export (LG-01, LG-02, docs/api/community-reports-and-admin.md): the
 * caller's own activity, of every type or of the types named. Only known types are accepted (SEC-INPUT-03).
 */
class ListMyActivityRequest extends FormRequest
{
    public const DEFAULT_PER_PAGE = 20;

    public const MAX_PER_PAGE = 50;

    /** Signed in and Active: the route's middleware has checked. Whose activity is listed is the session's to say. */
    public function authorize(): bool
    {
        return true;
    }

    /** `?type=request,adoption` is read as a list, so each value is checked against the enum. */
    protected function prepareForValidation(): void
    {
        $type = $this->query('type');
        if (is_string($type)) {
            $this->merge(['type' => array_values(array_filter(array_map('trim', explode(',', $type)), fn (string $value) => $value !== ''))]);
        }
    }

    public function rules(): array
    {
        return [
            'type' => ['sometimes', 'array'],
            'type.*' => ['string', Rule::enum(ActivityLogType::class)],
            'page' => ['sometimes', 'nullable', 'integer', 'min:1'],
        ];
    }

    public function messages(): array
    {
        return [
            'type.array' => 'Choose activity types from the list.',
            'type.*' => 'Choose activity types from the list.',
            'page.integer' => 'Choose a page number of 1 or more.',
            'page.min' => 'Choose a page number of 1 or more.',
        ];
    }

    /**
     * The types to list; none for every type.
     *
     * @return list<string>
     */
    public function types(): array
    {
        return array_values(array_unique($this->validated('type') ?? []));
    }

    /** As every list: 20 a page unless asked, never more than 50 (SEC-API-05). */
    public function perPage(): int
    {
        return min(max((int) $this->query('per_page', (string) self::DEFAULT_PER_PAGE), 1), self::MAX_PER_PAGE);
    }
}
