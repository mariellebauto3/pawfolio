<?php

namespace App\Enums;

/**
 * Target type a report can be filed against.
 * Matches reports.target_type and report_actions.target_type.
 */
enum ReportTargetType: string
{
    case Profile = 'profile';
    case Post = 'post';
    case Comment = 'comment';
    case Account = 'account';
}
