<?php

namespace App\Enums;

/**
 * Species a home profile accepts (PR-18) — a species not accepted is a dealbreaker.
 * Matches home_profile_accepted_species.species.
 */
enum AcceptedSpecies: string
{
    case Dog = 'dog';
    case Cat = 'cat';
    case Other = 'other';
}
