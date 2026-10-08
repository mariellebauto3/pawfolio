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

    /** The reason in the words of the dialogs (MG-10, MG-13), for a notification the other side reads. */
    public function label(): string
    {
        return match ($this) {
            self::ScheduleConflict => 'Schedule conflict',
            self::PetUnwell => 'Pet is unwell',
            self::WeatherOrTravel => 'Weather or travel problem',
            self::Other => 'Other',
            self::DidntShowPetSide => "The pet's side didn't show up",
            self::DidntShowHumanSide => "The human couldn't make it",
            self::MovedToAnotherDay => 'Moved to another day',
        };
    }
}
