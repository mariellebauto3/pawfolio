<?php

namespace App\Enums;

enum Role: string
{
    case Pet = 'pet';
    case Human = 'human';
    case Admin = 'admin';
}
