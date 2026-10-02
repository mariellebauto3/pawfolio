<?php

namespace App\Enums;

/**
 * Hours away from home — nullable until quiz (PR-16), 15 match points.
 * Matches home_profiles.hours_away.
 */
enum HoursAway: string
{
    case ZeroToTwo = '0_to_2';
    case ThreeToFive = '3_to_5';
    case SixToEight = '6_to_8';
    case NinePlus = '9_plus';
}
