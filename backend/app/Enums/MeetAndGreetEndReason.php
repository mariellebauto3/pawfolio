<?php

namespace App\Enums;

/**
 * Reason a Meet & Greet booking ended (MG-10, MG-13).
 * Matches meet_and_greets.end_reason.
 */
enum MeetAndGreetEndReason: string
{
    case ScheduleConflict = 'schedule_conflict';
    case PetUnwell = 'pet_unwell';
    case WeatherOrTravel = 'weather_or_travel';
    case Other = 'other';
    case DidntShowPetSide = 'didnt_show_pet_side';
    case DidntShowHumanSide = 'didnt_show_human_side';
    case MovedToAnotherDay = 'moved_to_another_day';
}
