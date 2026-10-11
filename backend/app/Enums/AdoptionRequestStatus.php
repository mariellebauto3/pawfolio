<?php

namespace App\Enums;

/**
 * Status of an adoption request through its lifecycle.
 * Matches adoption_requests.status (proposal §5.3, system-set only).
 */
enum AdoptionRequestStatus: string
{
    case Sent = 'sent';
    case OnHold = 'on_hold';
    case Approved = 'approved';
    case MeetScheduled = 'meet_scheduled';
    case AwaitingDecision = 'awaiting_decision';
    case Adopted = 'adopted';
    case Declined = 'declined';
    case NotAdopted = 'not_adopted';
    case Withdrawn = 'withdrawn';
    case Closed = 'closed';
    case Expired = 'expired';
}
