<?php

namespace App\Enums;

/**
 * Preferred pet age group (PR-18).
 * Matches home_profile_preferred_ages.age_group.
 */
enum PreferredAgeGroup: string
{
    case PuppyKitten = 'puppy_kitten';
    case Adult = 'adult';
    case Senior = 'senior';
}
