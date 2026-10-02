<?php

namespace App\Enums;

/**
 * Owner's prior pet-experience level — nullable until quiz (PR-17).
 * Matches home_profiles.pet_experience.
 */
enum PetExperience: string
{
    case FirstTime = 'first_time';
    case Some = 'some';
    case Experienced = 'experienced';
}
