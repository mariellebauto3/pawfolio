<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\Notification;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

class NotificationPolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->isActive();
    }

    public function view(User $user, Notification $notification): bool
    {
        return $user->id === $notification->user_id;
    }

    public function markAsRead(User $user, Notification $notification): bool
    {
        return $user->id === $notification->user_id;
    }

    public function markAsUnread(User $user, Notification $notification): bool
    {
        return $user->id === $notification->user_id;
    }

    public function update(User $user, Notification $notification): bool
    {
        return $user->id === $notification->user_id;
    }

    public function delete(User $user, Notification $notification): bool
    {
        return $user->id === $notification->user_id;
    }

    public function dismiss(User $user, Notification $notification): bool
    {
        return $user->id === $notification->user_id;
    }

    public function resend(User $user, Notification $notification): bool
    {
        return $user->id === $notification->user_id;
    }

    public function retry(User $user, Notification $notification): bool
    {
        return $user->id === $notification->user_id;
    }
}
