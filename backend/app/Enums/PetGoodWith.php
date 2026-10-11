<?php

namespace App\Enums;

/**
 * Pet temperament flags — nullable until PR-06.
 * Matches pets.good_with_kids / good_with_dogs / good_with_cats.
 */
enum PetGoodWith: string
{
    case Yes = 'yes';
    case No = 'no';
    case Unknown = 'unknown';
}
