<?php

declare(strict_types=1);

namespace App\Http\Resources\Auth;

use App\Models\VerificationDocument;
use App\Models\VerificationSubmission;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * One row of `GET /admin/verifications` (AU-22). Expects `user.pet`, `user.homeProfile`, `documents` and the
 * `earlier_submissions_count` count to be loaded.
 *
 * @mixin VerificationSubmission
 */
class VerificationQueueItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $account = $this->user;

        return [
            'account_id' => $account->id,
            'role' => $account->getRole()->value,
            'display_name' => $account->displayName(),
            'caretaker_name' => $account->isPet() ? $account->pet?->caretaker_name : null,
            'submitted_at' => $this->submitted_at?->toISOString(),
            'is_resubmission' => (int) $this->earlier_submissions_count > 0,
            'documents' => $this->documents
                ->map(fn (VerificationDocument $document) => (new VerificationDocumentResource($document))->toArray($request))
                ->values()
                ->all(),
        ];
    }
}
