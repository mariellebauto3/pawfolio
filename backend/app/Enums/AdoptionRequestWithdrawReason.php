<?php

namespace App\Enums;

/**
 * Optional withdraw reason on an adoption request.
 * Matches adoption_requests.withdraw_reason (RQ-16).
 */
enum AdoptionRequestWithdrawReason: string
{
    case FoundBetterMatch = 'found_better_match';
    case CaretakerCantMakeSchedule = 'caretaker_cant_make_schedule';
    case PetNoLongerAvailable = 'pet_no_longer_available';
    case Other = 'other';
}
