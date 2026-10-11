<?php

namespace App\Enums;

enum PetStatus: string
{
    case Draft = 'draft';
    case LookingForAHome = 'looking_for_a_home';
    case InProcess = 'in_process';
    case AdoptedHired = 'adopted_hired';
}
