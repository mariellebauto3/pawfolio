<?php

namespace App\Enums;

/**
 * No status column on home_profiles today. Kept as a placeholder so the
 * HomeProfile model's casts reference a real enum; removed if a status column
 * is added later.
 */
enum HomeProfileStatus: string
{
    // no cases yet
}
