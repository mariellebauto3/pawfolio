<?php

namespace App\Enums;

/**
 * Report status (RP-03).
 * Matches reports.status.
 */
enum ReportStatus: string
{
    case Open = 'open';
    case Resolved = 'resolved';
}
