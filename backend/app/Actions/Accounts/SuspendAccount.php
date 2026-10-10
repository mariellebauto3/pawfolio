<?php

declare(strict_types=1);

namespace App\Actions\Accounts;

use App\Enums\AccountAction as AccountActionEnum;
use App\Enums\AccountStatus;
use App\Enums\ActivityLogType;
use App\Enums\NotificationType;
use App\Models\AccountAction;
use App\Models\User;
use App\Services\ActivityLogs\ActivityLogger;
use App\Services\Notifications\NotificationService;
use Illuminate\Support\Facades\DB;

/**
 * Suspends an account (FR34, AC-08, and RP-05 when a report leads to it): the status changes, the reason is kept
 * for the owner's Suspended screen (AU-21), every session ends at once (SEC-ABUSE-04) and its open requests are
 * closed (proposal §5.3). The profile is hidden by the status itself. Call it inside a transaction.
 */
class SuspendAccount
{
    public function __construct(
        private readonly CloseAccountRequests $closeRequests,
        private readonly NotificationService $notifications,
    ) {}

    /**
     * @param  string  $logAction  how the activity log names it: from the account page, or from a report
     * @param  bool  $notify  false when the caller writes its own notification (a report's outcome)
     */
    public function handle(
        User $account,
        User $admin,
        string $reason,
        string $logAction = 'account_suspended',
        bool $notify = true,
        ?string $userAgent = null,
    ): void {
        $before = $account->getStatus()->value;

        $account->status = AccountStatus::Suspended;
        $account->save();

        $record = new AccountAction;
        $record->user_id = $account->id;
        $record->performed_by_user_id = $admin->id;
        $record->action = AccountActionEnum::Suspend->value;
        $record->reason = $reason;
        $record->save();

        DB::table(config('session.table', 'sessions'))->where('user_id', $account->id)->delete();
        $account->tokens()->delete();

        $this->closeRequests->handle($account, $admin, 'Account suspended');

        if ($notify) {
            $this->notifications->store(
                recipient: $account,
                type: NotificationType::AccountAction->value,
                title: 'Your account has been suspended',
                body: $reason,
                data: [
                    'category' => 'Account',
                    'action' => 'suspend',
                    'reason' => $reason,
                ],
                urgency: 'urgent',
            );
        }

        ActivityLogger::log(
            type: ActivityLogType::Account,
            action: $logAction,
            actor: $admin,
            subject: $account,
            before: $before,
            after: AccountStatus::Suspended->value,
            reason: $reason,
            userAgent: $userAgent,
        );
    }
}
