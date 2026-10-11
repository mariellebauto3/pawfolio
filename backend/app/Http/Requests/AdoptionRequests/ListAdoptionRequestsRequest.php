<?php

declare(strict_types=1);

namespace App\Http\Requests\AdoptionRequests;

use App\Enums\AdoptionRequestStatus;
use App\Models\AdoptionRequest;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * What may be asked of `GET /adoption-requests` (RQ-07…RQ-10, docs/api/adoption-and-meet-greet.md): one tab of the
 * caller's own requests, or the statuses named, a page at a time. Only known tabs and statuses are accepted
 * (SEC-INPUT-03).
 */
class ListAdoptionRequestsRequest extends FormRequest
{
    public const DEFAULT_PER_PAGE = 20;

    public const MAX_PER_PAGE = 50;

    /** The tabs of My requests (a pet: Active, Closed) and of the inbox (a human: New, In progress, Closed). */
    public const TABS = ['active', 'new', 'in_progress', 'closed'];

    /** A pet or a human reads its own (AdoptionRequestPolicy); the route's middleware has checked signed-in and Active. */
    public function authorize(): bool
    {
        return $this->user()?->can('viewAny', AdoptionRequest::class) ?? false;
    }

    /** `?status=sent,on_hold` is read as a list, so each value is checked against the enum. */
    protected function prepareForValidation(): void
    {
        $status = $this->query('status');
        if (is_string($status)) {
            $this->merge(['status' => array_values(array_filter(array_map('trim', explode(',', $status)), fn (string $value) => $value !== ''))]);
        }
    }

    public function rules(): array
    {
        return [
            'tab' => ['sometimes', 'nullable', 'string', Rule::in(self::TABS)],
            'status' => ['sometimes', 'array'],
            'status.*' => ['string', Rule::enum(AdoptionRequestStatus::class)],
            'page' => ['sometimes', 'nullable', 'integer', 'min:1'],
        ];
    }

    public function messages(): array
    {
        return [
            'tab.in' => 'Choose one of the request tabs.',
            'status.array' => 'Choose request statuses from the list.',
            'status.*' => 'Choose request statuses from the list.',
            'page.integer' => 'Choose a page number of 1 or more.',
            'page.min' => 'Choose a page number of 1 or more.',
        ];
    }

    /**
     * The statuses to list: the ones named, else the tab's, else null for every status.
     *
     * @return list<string>|null
     */
    public function statuses(): ?array
    {
        $named = $this->validated('status') ?? [];
        if ($named !== []) {
            return array_values($named);
        }

        return match ($this->validated('tab')) {
            'active' => AdoptionRequest::OPEN_STATUSES,
            'new' => [AdoptionRequestStatus::Sent->value],
            // Everything still open that isn't new, On Hold included, so the three tabs of the inbox leave nothing out.
            'in_progress' => array_values(array_diff(AdoptionRequest::OPEN_STATUSES, [AdoptionRequestStatus::Sent->value])),
            'closed' => AdoptionRequest::CLOSED_STATUSES,
            default => null,
        };
    }

    /** As every list: 20 a page unless asked, never more than 50 (SEC-API-05). */
    public function perPage(): int
    {
        return min(max((int) $this->query('per_page', (string) self::DEFAULT_PER_PAGE), 1), self::MAX_PER_PAGE);
    }
}
