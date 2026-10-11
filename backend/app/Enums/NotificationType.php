<?php

declare(strict_types=1);

namespace App\Enums;

enum NotificationType: string
{
    case RequestReceived = 'request_received';
    case RequestApproved = 'request_approved';
    case RequestUnderReview = 'request_under_review';
    case RequestDeclined = 'request_declined';
    case InviteSent = 'invite_sent';
    case MeetGreetBooked = 'meet_greet_booked';
    case MeetGreetCancelled = 'meet_greet_cancelled';
    case VerificationApproved = 'verification_approved';
    case VerificationDenied = 'verification_denied';
    case AccountAction = 'account_action';
    case Announcement = 'announcement';
}
