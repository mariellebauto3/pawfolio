<?php

namespace App\Enums;

/**
 * Preferred pet size (PR-18).
 * Matches home_profile_preferred_sizes.size.
 */
enum PreferredSize: string
{
    case Small = 'small';
    case Medium = 'medium';
    case Large = 'large';
}
