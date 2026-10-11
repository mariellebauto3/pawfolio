<?php

namespace App\Enums;

/**
 * Pet size — nullable until the résumé is edited (PR-03, FR6).
 * Matches pets.size.
 */
enum PetSize: string
{
    case Small = 'small';
    case Medium = 'medium';
    case Large = 'large';
}
