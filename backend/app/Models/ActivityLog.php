<?php

namespace App\Models;

use App\Enums\ActivityLogType;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ActivityLog extends Model
{
    protected $table = 'activity_logs';

    protected $fillable = [
        'actor_user_id',
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
    ];

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }

    public function subject(): BelongsTo
    {
        return $this->belongsTo(User::class)->whereColumn('id', 'subject_id');
    }

    public function getActivityType(): ActivityLogType
    {
        return ActivityLogType::tryFrom($this->type) ?: ActivityLogType::System;
    }

    public function getActorName(): string
    {
        $actor = $this->actor;
        if ($actor) {
            return $actor->displayName() ?? (string) $actor->id;
        }

        return 'System';
    }

    public function scopeOfType($query, ActivityLogType $type)
    {
        return $query->where('type', $type);
    }
}
