<?php

namespace App\Enums;

/**
 * Owner experience needed to care for the pet — nullable until PR-06.
 * Matches pets.experience_needed.
 */
enum PetExperienceNeeded: string
{
    case FirstTimeOk = 'first_time_ok';
    case SomeExperience = 'some_experience';
    case ExperiencedOnly = 'experienced_only';
}
