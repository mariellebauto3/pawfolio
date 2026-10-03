<?php

namespace App\Enums;

/**
 * Home type — nullable until quiz (PR-15).
 * Matches home_profiles.home_type.
 */
enum HomeType: string
{
    case House = 'house';
    case Condo = 'condo';
    case Apartment = 'apartment';
    case Townhouse = 'townhouse';
}
