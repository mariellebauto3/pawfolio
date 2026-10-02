<?php

namespace App\Models;

use App\Enums\AnnouncementAudience;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Announcement extends Model
{
    protected $table = 'announcements';

    protected $fillable = [
        'admin_user_id',
        'title',
        'message',
        'audience',
        'publish_at',
        'published_at',
    ];

    protected $casts = [
        'id' => 'integer',
        'admin_user_id' => 'integer',
        'publish_at' => 'datetime',
        'published_at' => 'datetime',
    ];

    public function admin(): BelongsTo
    {
        return $this->belongsTo(User::class, 'admin_user_id');
    }

    public function audience(): AnnouncementAudience
    {
        return AnnouncementAudience::tryFrom($this->audience) ?: AnnouncementAudience::Everyone;
    }

    public function isPublished(): bool
    {
        return $this->published_at !== null;
    }

    public function isAllAudience(): bool
    {
        return $this->audience() === AnnouncementAudience::Everyone;
    }

    public function isPetsAudience(): bool
    {
        return $this->audience() === AnnouncementAudience::Pets;
    }

    public function isHumansAudience(): bool
    {
        return $this->audience() === AnnouncementAudience::Humans;
    }
}
