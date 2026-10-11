<?php

declare(strict_types=1);

namespace App\Enums;

enum NotificationUrgency: string
{
    case Info = 'info';
    case Warning = 'warning';
    case Urgent = 'urgent';
}
