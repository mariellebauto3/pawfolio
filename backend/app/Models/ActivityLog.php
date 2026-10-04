<?php

namespace App\Models;

use App\Enums\ActivityLogType;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

/**
 * Append-only activity log row (SEC-LOG-04).
 */
class ActivityLog extends Model
{
    use HasFactory;

    public const UPDATED_AT = null;

    protected $table = 'activity_logs';

    protected $fillable = [
        'type',
        'action',
        'subject_type',
        'subject_id',
        'before_value',
        'after_value',
        'reason',
        'user_agent',
    ];

    protected $casts = [
        'id' => 'integer',
        'actor_user_id' => 'integer',
        'subject_id' => 'integer',
        'created_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::updating(function (): void {
            throw new LogicException('Activity logs are append-only and cannot be updated.');
        });

        static::deleting(function (): void {
            throw new LogicException('Activity logs are append-only and cannot be deleted.');
        });
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }

    public function logType(): ActivityLogType
    {
        return ActivityLogType::tryFrom((string) $this->type) ?: ActivityLogType::System;
    }

    public function isFromSystem(): bool
    {
        return $this->actor_user_id === null;
    }
}
