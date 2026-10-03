<?php

namespace App\Enums;

/**
 * Household activity level — nullable until quiz, 20 match points (PR-16).
 * Matches home_profiles.activity_level.
 */
enum ActivityLevel: string
{
    case Relaxed = 'relaxed';
    case Moderate = 'moderate';
    case Active = 'active';
    case VeryActive = 'very_active';
}
