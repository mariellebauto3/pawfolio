<?php

declare(strict_types=1);

namespace App\Actions\Auth;

use App\Enums\AccountStatus;
use App\Enums\ActivityLogType;
use App\Enums\DenialReason;
use App\Enums\VerificationSubmissionStatus;
use App\Exceptions\VerificationAlreadyReviewed;
use App\Models\User;
use App\Models\VerificationSubmission;
use App\Services\ActivityLogs\ActivityLogger;
use App\Services\Auth\VerificationQueue;
use App\Services\Notifications\NotificationService;
use Illuminate\Support\Facades\DB;

/**
 * Denies an account's pending submission with the reason the owner will read (BE-08, AU-25, AU-20, FR33).
 * The owner can correct their details and resubmit (AU-19).
 */
class DenyVerification
{
    private const DEFAULT_NOTICE = "Your account wasn't approved. Open your account status to see why, then correct your details and resubmit.";

    public function __construct(
        private readonly VerificationQueue $queue,
        private readonly NotificationService $notifications,
    ) {}

    /**
     * @throws VerificationAlreadyReviewed
     */
    public function __invoke(
        int $accountId,
        User $admin,
        DenialReason $reason,
        ?string $messageToOwner,
        ?string $userAgent = null,
    ): VerificationSubmission {
        return DB::transaction(function () use ($accountId, $admin, $reason, $messageToOwner, $userAgent): VerificationSubmission {
            $submission = $this->queue->lockForDecision($accountId);
            /** @var User $account */
            $account = $submission->user;
            $before = $account->getStatus()->value;

            $submission->status = VerificationSubmissionStatus::Denied->value;
            $submission->reviewed_by_user_id = $admin->id;
            $submission->reviewed_at = now();
            $submission->denial_reason = $reason->value;
            $submission->message_to_owner = $messageToOwner;
            $submission->save();

            $account->status = AccountStatus::Denied;
            $account->save();

            ActivityLogger::log(
                type: ActivityLogType::Verification,
                action: 'account_denied',
                actor: $admin,
                subject: $account,
                before: $before,
                after: AccountStatus::Denied->value,
                reason: $messageToOwner === null ? $reason->value : "{$reason->value}: {$messageToOwner}",
                userAgent: $userAgent,
            );

            $body = $messageToOwner ?? self::DEFAULT_NOTICE;

            $this->notifications->store(
                recipient: $account,
                type: 'verification_denied',
                title: 'Verification update needed',
                body: $body,
                data: [
                    'category' => 'Account',
                    'title' => 'Verification update needed',
                    'message' => $body,
                    'denial_reason' => $reason->value,
                    'link' => '/account/edit',
                ],
                urgency: 'warning',
                actionUrl: '/account/edit',
            );

            return $submission;
        });
    }
}
