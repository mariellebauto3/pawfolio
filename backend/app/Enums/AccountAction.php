<?php

namespace App\Enums;

/**
 * Account lifecycle action recorded in account_actions.
 * Matches account_actions.action (FR34, AC-05, AC-08–10).
 */
enum AccountAction: string
{
    case Suspend = 'suspend';
    case Reactivate = 'reactivate';
    case Deactivate = 'deactivate';
}
