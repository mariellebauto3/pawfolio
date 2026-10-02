<?php

namespace App\Enums;

/**
 * Hours a pet can be left alone — nullable until PR-06.
 * Matches pets.time_alone.
 */
enum PetTimeAlone: string
{
    case UpTo2Hrs = 'up_to_2_hrs';
    case UpTo4Hrs = 'up_to_4_hrs';
    case UpTo6Hrs = 'up_to_6_hrs';
    case EightPlusHrs = '8_plus_hrs';
}
