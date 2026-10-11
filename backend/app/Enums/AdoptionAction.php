<?php

namespace App\Enums;

/**
 * Manual resolution action by an admin (AL-07).
 * Matches adoption_resolutions.action.
 */
enum AdoptionAction: string
{
    case CancelAdoption = 'cancel_adoption';
    case ReturnToLookingForAHome = 'return_to_looking_for_a_home';
    case CloseRequest = 'close_request';
    case ReopenMeetGreetBooking = 'reopen_meet_greet_booking';
}
