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
}
