<?php

namespace App\Enums;

/**
 * Where a Meet & Greet slot takes place (MG-02).
 * Matches meet_greet_slots.place_type.
 */
enum MeetGreetPlaceType: string
{
    case PublicSpot = 'public_spot';
    case Shelter = 'shelter';
    case CaretakerLocation = 'caretaker_location';
}
