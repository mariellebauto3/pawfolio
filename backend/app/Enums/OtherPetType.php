<?php

namespace App\Enums;

/**
 * Other-pet types at home (PR-14) — no rows means None.
 * Matches home_profile_other_pets.pet_type.
 */
enum OtherPetType: string
{
    case Dogs = 'dogs';
    case Cats = 'cats';
    case Other = 'other';
}
