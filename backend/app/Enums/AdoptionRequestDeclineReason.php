<?php

namespace App\Enums;

/**
 * Optional decline reason on an adoption request.
 * Matches adoption_requests.decline_reason (RQ-13).
 */
enum AdoptionRequestDeclineReason: string
{
    case NotRightFit = 'not_right_fit';
    case NotAdoptingNow = 'not_adopting_now';
    case AnotherPetJoining = 'another_pet_joining';
    case Other = 'other';
}
