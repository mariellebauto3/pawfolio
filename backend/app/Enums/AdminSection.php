<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * The sections of the admin sidebar that carry a count (GN-01). The values are the ids the frontend's navigation
 * uses, and the allow-list for `POST /admin/sidebar/{section}/seen` (SEC-INPUT-03).
 */
enum AdminSection: string
{
    case Verification = 'verification';
    case Reports = 'reports';
    case Requests = 'requests';
}
