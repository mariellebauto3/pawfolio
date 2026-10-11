<?php

declare(strict_types=1);

namespace App\Http\Requests\ActivityLogs;

use Illuminate\Validation\Rule;

/**
 * What may be asked of `GET /admin/activity-logs` and its export (LG-03): the platform's log, narrowed by type, by
 * who acted and by words in the action or the reason. The order is fixed (newest first), so there is no sort to list.
 */
class ListActivityLogsRequest extends ListMyActivityRequest
{
    /** Who acted. `system` is an entry nobody is the actor of: a scheduled job, a status the system changed. */
    public const ACTOR_ROLES = ['admin', 'pet', 'human', 'system'];

    public const SEARCH_MAX = 100;

    /** Admin only: the route's `role:admin` middleware has already checked (SEC-AUTHZ-07). */
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        parent::prepareForValidation();

        if (is_string($this->query('q'))) {
            $this->merge(['q' => trim($this->query('q'))]);
        }
    }

    public function rules(): array
    {
        return [
            ...parent::rules(),
            // Allow-list (SEC-INPUT-03).
            'actor_role' => ['sometimes', 'nullable', 'string', Rule::in(self::ACTOR_ROLES)],
            'actor_user_id' => ['sometimes', 'nullable', 'integer', 'min:1'],
            'q' => ['sometimes', 'nullable', 'string', 'max:'.self::SEARCH_MAX],
        ];
    }

    public function messages(): array
    {
        return [
            ...parent::messages(),
            'actor_role.string' => 'Choose Admins, Pets, Humans or System.',
            'actor_role.in' => 'Choose Admins, Pets, Humans or System.',
            'actor_user_id.integer' => 'Choose an account.',
            'actor_user_id.min' => 'Choose an account.',
            'q.string' => 'Search for '.self::SEARCH_MAX.' characters or fewer.',
            'q.max' => 'Search for '.self::SEARCH_MAX.' characters or fewer.',
        ];
    }

    public function actorRole(): ?string
    {
        return $this->validated('actor_role') ?: null;
    }

    public function actorUserId(): ?int
    {
        $id = $this->validated('actor_user_id');

        return $id === null || $id === '' ? null : (int) $id;
    }

    public function search(): ?string
    {
        return $this->validated('q') ?: null;
    }
}
