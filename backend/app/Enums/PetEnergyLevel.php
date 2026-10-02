<?php

namespace App\Enums;

/**
 * Pet energy level — nullable until PR-05.
 * Matches pets.energy_level (PR-05, 20 match points).
 */
enum PetEnergyLevel: string
{
    case Low = 'low';
    case Medium = 'medium';
    case High = 'high';
}
