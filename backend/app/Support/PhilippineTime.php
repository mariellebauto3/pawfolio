<?php

declare(strict_types=1);

namespace App\Support;

use Carbon\CarbonInterface;

/**
 * Dates are stored in UTC. Pawfolio is used in the Philippines, so a time written into a message a person reads
 * (a notification about a Meet & Greet slot) is written in Philippine time, as the screens show it.
 */
final class PhilippineTime
{
    public const TIME_ZONE = 'Asia/Manila';

    /** "Sat, Oct 10, 10:00 AM" */
    public static function format(CarbonInterface $at): string
    {
        return $at->copy()->setTimezone(self::TIME_ZONE)->format('D, M j, g:i A');
    }
}
