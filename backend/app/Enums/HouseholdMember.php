<?php

namespace App\Enums;

/**
 * Household member options (PR-14).
 * Matches home_profile_household_members.member.
 */
enum HouseholdMember: string
{
    case JustMe = 'just_me';
    case Partner = 'partner';
    case KidsUnder6 = 'kids_under_6';
    case Kids6To12 = 'kids_6_to_12';
    case Teens = 'teens';
    case Seniors = 'seniors';
}
