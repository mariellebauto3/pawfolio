<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property Ulid $id
 * @property int $user_id
 * @property string $type
 * @property string $title
 * @property string $body
 * @property array $data
 * @property string|null $read_at
 * @property string|null $dismissed_at
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

    public $fillable = [
        'user_id',
        'type',
        'title',
        'body',
        'data',
        'read_at',
        'dismissed_at',
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
        // true when the thread has been read (read_at is set).
        return $this->read_at !== null;
    }

    public function getIsDismissedAttribute(): bool
    {
        return (bool) $this->dismissed_at;
    }

    public function getActionUrlAttribute(?string $url = null): ?string
    {
        return $url ?: ($this->data['action'] ?? null);
    }

    public function getSenderAttribute(): string
    {
        return $this->user->display_name ?? $this->user->email ?? 'system';
    }

    public function markAsRead(): self
    {
        $this->update(['read_at' => now()]);

        return $this;
    }

    public function markAsUnread(): self
    {
        $this->update(['read_at' => null]);

        return $this;
    }

    public function dismiss(): self
    {
        $this->update(['dismissed_at' => now()]);

        return $this;
    }
}
