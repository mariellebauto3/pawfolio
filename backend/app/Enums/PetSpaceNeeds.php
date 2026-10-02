<?php

namespace App\Enums;

/**
 * Pet space-needs tier — nullable until PR-06.
 * Matches pets.space_needs.
 */
enum PetSpaceNeeds: string
{
    case ApartmentOk = 'apartment_ok';
    case NeedsYardOrDailyWalks = 'needs_yard_or_daily_walks';
    case GroundFloor = 'ground_floor';
}
