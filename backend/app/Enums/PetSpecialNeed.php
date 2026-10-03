<?php

namespace App\Enums;

/**
 * Special-needs / ongoing-care flag with no rows meaning None (PR-07).
 * Matches pet_special_needs.need.
 */
enum PetSpecialNeed: string
{
    case DailyMeds = 'daily_meds';
    case SpecialDiet = 'special_diet';
    case MobilitySupport = 'mobility_support';
}
