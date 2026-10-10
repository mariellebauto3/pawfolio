<?php

namespace App\Models;

use App\Enums\AnnouncementAudience;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Announcement extends Model
{
    use HasFactory;

    protected $table = 'announcements';

    protected $fillable = [
        'title',
        'message',
        'audience',
        'publish_at',
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
        return AnnouncementAudience::tryFrom((string) $this->audience) ?: AnnouncementAudience::Everyone;
    }

    public function isPublished(): bool
    {
        return $this->published_at !== null;
    }

    public function isScheduled(): bool
    {
        return $this->publish_at !== null && $this->published_at === null;
    }

    public function scopePublished($query)
    {
        return $query->whereNotNull('published_at');
    }

    /** Published announcements meant for this account: Everyone's, and its own role's (NT-04). */
    public function scopeVisibleTo($query, User $user)
    {
        $audiences = [AnnouncementAudience::Everyone->value];
        if ($user->isPet()) {
            $audiences[] = AnnouncementAudience::Pets->value;
        } elseif ($user->isHuman()) {
            $audiences[] = AnnouncementAudience::Humans->value;
        }

        return $query->whereNotNull('published_at')->whereIn('audience', $audiences);
    }

    public function scopeDue($query)
    {
        return $query->whereNull('published_at')
            ->where(function ($q) {
                $q->whereNull('publish_at')->orWhere('publish_at', '<=', now());
            });
    }
}
