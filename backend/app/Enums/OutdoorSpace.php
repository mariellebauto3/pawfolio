<?php

namespace App\Enums;

/**
 * Outdoor space available at home — nullable until quiz (PR-15).
 * Matches home_profiles.outdoor_space.
 */
enum OutdoorSpace: string
{
    case None = 'none';
    case Balcony = 'balcony';
    case SmallYard = 'small_yard';
    case LargeYard = 'large_yard';
}
