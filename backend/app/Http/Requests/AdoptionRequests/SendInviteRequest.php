<?php

declare(strict_types=1);

namespace App\Http\Requests\AdoptionRequests;

use App\Models\Invite;
use Illuminate\Foundation\Http\FormRequest;

/**
 * The body of `POST /pets/{pet}/invites` (RQ-01, FR9): the optional personal note. Only `note` is read; the pet comes
 * from the path and the home is the sender's own, so neither can be set from the body (SEC-INPUT-04).
 */
class SendInviteRequest extends FormRequest
{
    public const NOTE_MAX = 200;

    /** Only a human invites (InvitePolicy); the route's middleware has checked signed-in and Active. */
    public function authorize(): bool
    {
        return $this->user()?->can('create', Invite::class) ?? false;
    }

    protected function prepareForValidation(): void
    {
        $note = $this->input('note');
        if (is_string($note)) {
            $note = trim($note);
            $this->merge(['note' => $note === '' ? null : $note]);
        }
    }

    public function rules(): array
    {
        return [
            'note' => ['nullable', 'string', 'max:'.self::NOTE_MAX],
        ];
    }

    public function messages(): array
    {
        $short = 'Keep the note to '.self::NOTE_MAX.' characters or fewer.';

        return [
            'note.string' => $short,
            'note.max' => $short,
        ];
    }

    public function note(): ?string
    {
        return $this->validated('note');
    }
}
