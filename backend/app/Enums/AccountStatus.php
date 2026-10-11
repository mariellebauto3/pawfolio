<?php

namespace App\Enums;

enum AccountStatus: string
{
    case PendingVerification = 'pending_verification';
    case Active = 'active';
    case Denied = 'denied';
    case Suspended = 'suspended';
    case Deactivated = 'deactivated';
}
