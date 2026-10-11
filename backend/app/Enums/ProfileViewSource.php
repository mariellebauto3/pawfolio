<?php

namespace App\Enums;

/**
 * Where a profile view originated (AN-01).
 * Matches profile_views.source.
 */
enum ProfileViewSource: string
{
    case Browse = 'browse';
    case Search = 'search';
    case Matches = 'matches';
    case Bookmarks = 'bookmarks';
    case Feed = 'feed';
    case Direct = 'direct';
}
