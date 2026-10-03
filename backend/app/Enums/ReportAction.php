<?php

namespace App\Enums;

/**
 * Admin action taken on a resolved report (FR35, RP-05).
 * Matches report_actions.action.
 */
enum ReportAction: string
{
    case RemoveContent = 'remove_content';
    case SuspendAccount = 'suspend_account';
    case RemoveContentAndSuspend = 'remove_content_and_suspend';
    case Dismiss = 'dismiss';
}
