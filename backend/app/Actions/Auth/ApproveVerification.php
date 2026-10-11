<?php

declare(strict_types=1);

namespace App\Actions\Auth;

use App\Enums\AccountStatus;
use App\Enums\ActivityLogType;
use App\Enums\VerificationDocumentType;
use App\Enums\VerificationSubmissionStatus;
use App\Exceptions\VerificationAlreadyReviewed;
use App\Models\Pet;
use App\Models\User;
use App\Models\VerificationSubmission;
use App\Services\ActivityLogs\ActivityLogger;
use App\Services\Auth\VerificationQueue;
use App\Services\Notifications\NotificationService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Approves an account's pending submission: the account becomes Active (BE-08, AU-26, FR33).
 *
 * The only place an account goes from Pending Verification to Active (FR27), so automatic ID checks (proposal §10)
 * can be added here later without touching the endpoints (NFR6).
 */
class ApproveVerification
{
    public function __construct(
        private readonly VerificationQueue $queue,
        private readonly NotificationService $notifications,
    ) {}

    /**
     * @throws VerificationAlreadyReviewed
     */
    public function __invoke(int $accountId, User $admin, ?string $userAgent = null): VerificationSubmission
    {
        return DB::transaction(function () use ($accountId, $admin, $userAgent): VerificationSubmission {
            $submission = $this->queue->lockForDecision($accountId);
            /** @var User $account */
            $account = $submission->user;
            $before = $account->getStatus()->value;

            $submission->status = VerificationSubmissionStatus::Approved->value;
            $submission->reviewed_by_user_id = $admin->id;
            $submission->reviewed_at = now();
            $submission->save();

            $account->status = AccountStatus::Active;
            $account->email_verified_at ??= now();
            $account->save();

            if ($account->isPet() && $account->pet !== null) {
                $this->publishSignUpPhotos($account->pet, $submission);
            }

            ActivityLogger::log(
                type: ActivityLogType::Verification,
                action: 'account_approved',
                actor: $admin,
                subject: $account,
                before: $before,
                after: AccountStatus::Active->value,
                userAgent: $userAgent,
            );

            $body = $account->isPet()
                ? 'Welcome to Pawfolio! Complete your resume to go live.'
                : 'Welcome to Pawfolio! Complete your Home Profile and lifestyle quiz to start matching.';

            $this->notifications->store(
                recipient: $account,
                type: 'verification_approved',
                title: 'Account approved',
                body: $body,
                data: ['category' => 'Account', 'title' => 'Account approved', 'message' => $body, 'link' => '/me'],
                urgency: 'info',
                actionUrl: '/me',
            );

            return $submission;
        });
    }

    /**
     * The photos sent at sign-up are admin-only until now (SEC-PRIV-01). Once the account is approved they become
     * the pet's first gallery photos, copied to the public disk; the private copies stay as what the admin saw.
     */
    private function publishSignUpPhotos(Pet $pet, VerificationSubmission $submission): void
    {
        if ($pet->photos()->exists()) {
            return;
        }

        $photos = $submission->documents()
            ->where('document_type', VerificationDocumentType::PetPhoto->value)
            ->orderBy('id')
            ->get();

        $order = 0;
        foreach ($photos as $photo) {
            $contents = Storage::disk('local')->get($photo->file_path);
            if ($contents === null) {
                continue;
            }

            $path = 'pets/photos/'.Str::uuid()->toString().'.'.pathinfo($photo->file_path, PATHINFO_EXTENSION);
            Storage::disk('public')->put($path, $contents);

            $pet->photos()->create([
                'file_path' => $path,
                'caption' => null,
                'sort_order' => ++$order,
            ]);
        }
    }
}
