<?php

declare(strict_types=1);

namespace App\Actions\Accounts;

use App\Enums\AccountAction as AccountActionEnum;
use App\Enums\AccountStatus;
use App\Enums\ActivityLogType;
use App\Models\AccountAction;
use App\Models\User;
use App\Services\ActivityLogs\ActivityLogger;
use Illuminate\Support\Facades\DB;

/**
 * Deactivates an account, by its owner (AC-05) or by an admin (AC-10, FR34): the profile is hidden at once by the
 * status (SEC-PRIV-05), a human stops being Open to Adopt, open requests are closed (proposal §5.3) and every
 * session ends. Nothing is deleted: adoption history and logs keep their records (proposal §5.1). Call it inside a
 * transaction.
 */
class DeactivateAccount
{
    public function __construct(
        private readonly CloseAccountRequests $closeRequests,
    ) {}

    /**
     * @param  User  $actor  the owner, or the admin
     * @param  string  $logAction  `account_deactivated_by_owner` or `account_deactivated`
     */
    public function handle(User $account, User $actor, string $reason, string $logAction, ?string $userAgent = null): void
    {
        $before = $account->getStatus()->value;

        $account->status = AccountStatus::Deactivated;
        $account->save();

        $record = new AccountAction;
        $record->user_id = $account->id;
        $record->performed_by_user_id = $actor->id;
        $record->action = AccountActionEnum::Deactivate->value;
        $record->reason = $reason;
        $record->save();

        if ($account->homeProfile) {
            $account->homeProfile->is_open_to_adopt = false;
            $account->homeProfile->save();
        }

        $this->closeRequests->handle($account, $actor, 'Account deactivated');

        DB::table(config('session.table', 'sessions'))->where('user_id', $account->id)->delete();
        $account->tokens()->delete();

        ActivityLogger::log(
            type: ActivityLogType::Account,
            action: $logAction,
            actor: $actor,
            subject: $account,
            before: $before,
            after: AccountStatus::Deactivated->value,
            reason: $reason,
            userAgent: $userAgent,
        );
    }
}
