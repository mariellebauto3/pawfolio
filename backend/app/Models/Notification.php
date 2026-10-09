<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\NotificationCategory;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property int $user_id
 * @property string $type
 * @property string|null $category
 * @property string $title
 * @property string $body
 * @property array|null $data
 * @property Carbon|null $read_at
 * @property Carbon|null $dismissed_at
 * @property string $urgency
 * @property string|null $action_url
 * @property Carbon $created_at
 * @property Carbon $updated_at
 * @property-read User $user
 */
class Notification extends Model
{
    use HasFactory;
    use HasUlids;

    public const AUTHORS = [
        'admin' => 'admin',
        'system' => 'system',
    ];

    protected $fillable = [
        'type',
        'title',
        'body',
        'data',
        'urgency',
        'action_url',
    ];

    protected $casts = [
        'user_id' => 'integer',
        'read_at' => 'datetime',
        'dismissed_at' => 'datetime',
        'data' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Every row gets the tab it is listed under (NT-02) as it is written, whoever writes it: the category its
     * sender named in `data`, or its type's own.
     */
    protected static function booted(): void
    {
        static::creating(function (Notification $notification): void {
            $notification->category ??= NotificationCategory::of(
                (string) $notification->type,
                $notification->data['category'] ?? null,
            )?->value;
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function scopeForUser($query, int $userId): void
    {
        $query->where('user_id', $userId);
    }

    public function scopeUnread($query): void
    {
        $query->whereNull('read_at');
    }

    public function scopeDismissed($query): void
    {
        $query->whereNotNull('dismissed_at');
    }

    public function scopeByTypes($query, array $types): void
    {
        $query->whereIn('type', $types);
    }

    public function scopeNewestFirst($query): void
    {
        $query->orderByDesc('created_at');
    }

    public function getIsReadAttribute(): bool
    {
        return $this->read_at !== null;
    }

    public function getIsDismissedAttribute(): bool
    {
        return (bool) $this->dismissed_at;
    }

    public function getActionUrlAttribute(?string $url = null): ?string
    {
        return $url ?: ($this->data['action'] ?? $this->data['link'] ?? null);
    }

    public function getSenderAttribute(): string
    {
        return $this->user?->display_name ?? $this->user?->email ?? 'system';
    }

    public function markAsRead(): self
    {
        $this->read_at = now();
        $this->save();

        return $this;
    }

    public function markAsUnread(): self
    {
        $this->read_at = null;
        $this->save();

        return $this;
    }

    public function dismiss(): self
    {
        $this->dismissed_at = now();
        $this->save();

        return $this;
    }
}
