<?php

declare(strict_types=1);

namespace App\Http\Resources\Auth;

use App\Enums\VerificationSubmissionStatus;
use App\Models\User;
use App\Models\VerificationDocument;
use App\Models\VerificationSubmission;
use Carbon\CarbonInterface;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * `GET /admin/verifications/{accountId}` and the answers of approve and deny (AU-23..AU-26): an account's latest
 * submission, to review or to look back on. The caller adds `queue`.
 *
 * @mixin VerificationSubmission
 */
class VerificationReviewResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        /** @var User $account */
        $account = $this->user;

        // The last round an admin decided before this one. Rows the owner replaced by editing while still Pending
        // were never reviewed, so they aren't rounds.
        $previous = VerificationSubmission::query()
            ->where('user_id', $account->id)
            ->where('id', '<', $this->id)
            ->whereNotNull('reviewed_at')
            ->orderByDesc('id')
            ->first();

        $isFirst = ! VerificationSubmission::query()->where('user_id', $account->id)->where('id', '<', $this->id)->exists();

        return [
            'account_id' => $account->id,
            'display_name' => $account->displayName(),
            'account_status' => $account->getStatus()->value,
            'status' => $this->status,
            'submitted_at' => $this->submitted_at?->toISOString(),
            'is_resubmission' => ! $isFirst,
            'previous_denial' => $previous?->status === VerificationSubmissionStatus::Denied->value
                ? [
                    'denial_reason' => $previous->denial_reason,
                    'message_to_owner' => $previous->message_to_owner,
                    'reviewed_at' => $previous->reviewed_at?->toISOString(),
                ]
                : null,
            'reviewed_at' => $this->reviewed_at?->toISOString(),
            'reviewed_by' => $this->reviewedBy?->displayName() ?: null,
            'denial_reason' => $this->denial_reason,
            'message_to_owner' => $this->message_to_owner,
            'details' => $account->isPet() ? $this->petDetails($account) : $this->humanDetails($account),
            'documents' => $this->documents
                ->sortBy('id')
                ->map(fn (VerificationDocument $document) => (new VerificationDocumentResource($document, withId: true))->toArray($request))
                ->values()
                ->all(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function petDetails(User $account): array
    {
        $pet = $account->pet;

        return [
            'role' => 'pet',
            'name' => $pet?->name ?? '',
            'species' => $pet?->species ?? 'other',
            'breed' => $pet?->breed ?? '',
            'approximate_age_months' => (int) ($pet?->approximate_age_months ?? 0),
            'currently_at' => $pet?->currently_at ?? '',
            'city' => $pet?->city ?? '',
            'province' => $pet?->province ?? '',
            'caretaker_name' => $pet?->caretaker_name ?? '',
            // Shown to admins because verifying the account needs it (SEC-PRIV-02).
            'caretaker_contact_number' => $pet?->caretaker_contact_number ?? '',
        ];
    }

    /**
     * No street address: the review compares the name, the age and the ID (SEC-PRIV-04).
     *
     * @return array<string, mixed>
     */
    private function humanDetails(User $account): array
    {
        $home = $account->homeProfile;

        return [
            'role' => 'human',
            'full_name' => $home?->full_name ?? '',
            'birthdate' => $home?->birthdate instanceof CarbonInterface
                ? $home->birthdate->format('Y-m-d')
                : (string) ($home?->birthdate ?? ''),
            'contact_number' => $home?->contact_number ?? '',
            'city' => $home?->city ?? '',
            'province' => $home?->province ?? '',
        ];
    }
}
