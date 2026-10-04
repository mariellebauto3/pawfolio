<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Auth;

use App\Actions\Auth\UpdateSubmission;
use App\Enums\AccountAction as AccountActionEnum;
use App\Enums\AccountStatus;
use App\Enums\VerificationSubmissionStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\UpdateSubmissionRequest;
use App\Http\Resources\Auth\AuthenticatedUserResource;
use App\Http\Resources\ErrorResource;
use App\Http\Resources\ResponseResource;
use App\Models\User;
use App\Models\VerificationDocument;
use Carbon\CarbonInterface;
use Illuminate\Http\Request;

/**
 * Status and submission endpoints for Pending, Denied, and Suspended accounts (BE-06, AU-18..AU-21).
 */
class AccountStatusController extends Controller
{
    private const NOT_EDITABLE = 'Only accounts waiting for verification can edit their submitted details.';

    private const CLOSED = 'This account was closed.';

    public function status(Request $request): ResponseResource
    {
        /** @var User $user */
        $user = $request->user();
        $status = $user->getStatus();

        $submissions = $user->verificationSubmissions()
            ->with('documents')
            ->orderByDesc('submitted_at')
            ->orderByDesc('id')
            ->get();

        $latestSubmission = $submissions->first();
        $latestDenied = $submissions->firstWhere('status', VerificationSubmissionStatus::Denied->value);

        $denialReason = null;
        $reason = null;

        if ($status === AccountStatus::Denied && $latestDenied !== null) {
            $denialReason = $latestDenied->denial_reason;
            $reason = $latestDenied->message_to_owner;
        } elseif ($status === AccountStatus::Suspended) {
            $lastSuspend = $user->accountActions()
                ->where('action', AccountActionEnum::Suspend->value)
                ->latest('id')
                ->first();
            $reason = $lastSuspend?->reason;
        } elseif ($status === AccountStatus::Deactivated) {
            $reason = self::CLOSED;
        }

        $isResubmission = $status === AccountStatus::PendingVerification && $submissions->count() > 1;

        $documents = $latestSubmission
            ? $latestSubmission->documents->map(fn (VerificationDocument $doc) => self::formatDocument($doc))->values()->all()
            : [];

        return ResponseResource::make([
            'status' => $status->value,
            'denial_reason' => $denialReason,
            'reason' => $reason,
            'submitted_at' => $latestSubmission?->submitted_at?->toISOString(),
            'is_resubmission' => $isResubmission,
            'documents' => $documents,
        ]);
    }

    public function showSubmission(Request $request)
    {
        /** @var User $user */
        $user = $request->user();

        if (! $this->canEditSubmission($user)) {
            return ErrorResource::forbidden(self::NOT_EDITABLE)->toResponse($request);
        }

        $latestSubmission = $user->verificationSubmissions()
            ->with('documents')
            ->orderByDesc('submitted_at')
            ->orderByDesc('id')
            ->first();

        $documents = $latestSubmission
            ? $latestSubmission->documents->map(fn (VerificationDocument $doc) => self::formatDocument($doc))->values()->all()
            : [];

        if ($user->isPet()) {
            $pet = $user->pet;

            return ResponseResource::make([
                'role' => 'pet',
                'name' => $pet?->name ?? '',
                'species' => $pet?->species ?? 'dog',
                'breed' => $pet?->breed ?? '',
                'approximate_age_months' => (int) ($pet?->approximate_age_months ?? 1),
                'currently_at' => $pet?->currently_at ?? '',
                'city' => $pet?->city ?? '',
                'province' => $pet?->province ?? '',
                'caretaker_name' => $pet?->caretaker_name ?? '',
                'caretaker_contact_number' => $pet?->caretaker_contact_number ?? '',
                'documents' => $documents,
            ]);
        }

        $home = $user->homeProfile;

        return ResponseResource::make([
            'role' => 'human',
            'full_name' => $home?->full_name ?? '',
            'birthdate' => $home?->birthdate instanceof CarbonInterface
                ? $home->birthdate->format('Y-m-d')
                : (string) ($home?->birthdate ?? ''),
            'contact_number' => $home?->contact_number ?? '',
            'city' => $home?->city ?? '',
            'province' => $home?->province ?? '',
            'street_address' => $home?->street_address ?? '',
            'documents' => $documents,
        ]);
    }

    public function updateSubmission(Request $rawRequest, UpdateSubmission $updateSubmission)
    {
        /** @var User $user */
        $user = $rawRequest->user();

        if (! $this->canEditSubmission($user)) {
            return ErrorResource::forbidden(self::NOT_EDITABLE)->toResponse($rawRequest);
        }

        $formRequest = app(UpdateSubmissionRequest::class);
        $updatedUser = $updateSubmission($formRequest, $user);

        return new AuthenticatedUserResource($updatedUser);
    }

    private function canEditSubmission(User $user): bool
    {
        if ($user->isAdmin()) {
            return false;
        }

        return $user->isPendingVerification() || $user->isDenied();
    }

    /**
     * Format document metadata without leaking file_path or download URL (SEC-PRIV-01).
     *
     * @return array<string, mixed>
     */
    public static function formatDocument(VerificationDocument $doc): array
    {
        return [
            'document_type' => $doc->document_type,
            'id_type' => $doc->id_type,
            'mime_type' => $doc->mime_type,
            'size_bytes' => (int) $doc->size_bytes,
            'uploaded_at' => ($doc->created_at ?? now())->toISOString(),
        ];
    }
}
