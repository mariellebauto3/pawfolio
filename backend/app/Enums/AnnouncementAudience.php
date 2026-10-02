<?php

namespace App\Enums;

/**
 * Who an announcement is sent to (NT-04).
 * Matches announcements.audience.
 */
enum AnnouncementAudience: string
{
    case Everyone = 'everyone';
    case Pets = 'pets';
    case Humans = 'humans';
}
