<?php

namespace App\Enums;

/**
 * Pet sex — nullable until the résumé is edited (PR-03).
 * Matches pets.sex (AU-09).
 */
enum PetSex: string
{
    case Female = 'female';
    case Male = 'male';
}
