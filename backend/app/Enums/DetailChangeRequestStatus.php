<?php

namespace App\Enums;

/**
 * Status of an owner-requested change to a locked verified field.
 * Matches detail_change_requests.status (AC-03, AU-09).
 */
enum DetailChangeRequestStatus: string
{
    case Pending = 'pending';
    case Approved = 'approved';
    case Denied = 'denied';
}
