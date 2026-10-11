<?php

namespace App\Enums;

/**
 * Activity-log type filter (LG-01–03).
 * Matches activity_logs.type.
 */
enum ActivityLogType: string
{
    case Verification = 'verification';
    case Account = 'account';
    case StatusChange = 'status_change';
    case Request = 'request';
    case MeetAndGreet = 'meet_and_greet';
    case Adoption = 'adoption';
    case Feed = 'feed';
    case Profile = 'profile';
    case Moderation = 'moderation';
    case Announcement = 'announcement';
    case Security = 'security';
    case System = 'system';
}
