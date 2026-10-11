<?php

namespace App\Enums;

/**
 * Meet & Greet booking status (proposal §5.4).
 * Matches meet_and_greets.status.
 */
enum MeetAndGreetStatus: string
{
    case Booked = 'booked';
    case Confirmed = 'confirmed';
    case Ended = 'ended';
}
