<?php

namespace App\Enums;

/**
 * Community feed post type badge (FD-01, FD-04).
 * Matches posts.type.
 */
enum PostType: string
{
    case ForHire = 'for_hire';
    case Hired = 'hired';
    case Update = 'update';
    case Post = 'post';
    case AdoptionStory = 'adoption_story';
}
