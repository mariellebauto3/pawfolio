<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NotificationPreference extends Model
{
    protected $table = 'notification_preferences';

    protected $fillable = [
        'user_id',
        'requests_and_invites',
        'meet_and_greets',
        'post_activity',
        'announcements',
    ];

    protected $attributes = [
        'requests_and_invites' => true,
        'meet_and_greets' => true,
        'post_activity' => true,
        'announcements' => true,
    ];

    protected $casts = [
        'id' => 'integer',
        'user_id' => 'integer',
        'requests_and_invites' => 'boolean',
        'meet_and_greets' => 'boolean',
        'post_activity' => 'boolean',
        'announcements' => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function shouldRequestAndInvite(): bool
    {
        return (bool) $this->getAttribute('requests_and_invites');
    }

    public function shouldMeetAndGreet(): bool
    {
        return (bool) $this->getAttribute('meet_and_greets');
    }

    public function shouldPostActivity(): bool
    {
        return (bool) $this->getAttribute('post_activity');
    }

    public function shouldAnnouncements(): bool
    {
        return (bool) $this->getAttribute('announcements');
    }

    /** Category-gate accessors used by the WriteNotification queue listener (NT-08). */
    public function requests_and_invites(): bool
    {
        return (bool) $this->getAttribute('requests_and_invites');
    }

    public function meet_and_greets(): bool
    {
        return (bool) $this->getAttribute('meet_and_greets');
    }

    public function post_activity(): bool
    {
        return (bool) $this->getAttribute('post_activity');
    }

    public function announcements(): bool
    {
        return (bool) $this->getAttribute('announcements');
    }
}
