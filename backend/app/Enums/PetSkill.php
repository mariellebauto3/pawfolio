<?php

namespace App\Enums;

/**
 * Trained behaviour skill (PR-06).
 * Matches pet_skills.skill.
 */
enum PetSkill: string
{
    case SitAndStay = 'sit_and_stay';
    case LeashTrained = 'leash_trained';
    case PottyTrained = 'potty_trained';
    case CrateTrained = 'crate_trained';
    case LitterTrained = 'litter_trained';
    case ComesWhenCalled = 'comes_when_called';
    case LearningSit = 'learning_sit';
    case PottyTrainingInProgress = 'potty_training_in_progress';
    case ScratchingPostOnly = 'scratching_post_only';
    case QuietAtNight = 'quiet_at_night';
    case HouseTrained = 'house_trained';
    case Sit = 'sit';
    case Shake = 'shake';
}
