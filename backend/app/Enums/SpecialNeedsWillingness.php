<?php

namespace App\Enums;

/**
 * Willingness to take on a pet with special needs — nullable until quiz (PR-17).
 * Matches home_profiles.special_needs_willingness.
 */
enum SpecialNeedsWillingness: string
{
    case Yes = 'yes';
    case MinorNeedsOnly = 'minor_needs_only';
    case No = 'no';
}
