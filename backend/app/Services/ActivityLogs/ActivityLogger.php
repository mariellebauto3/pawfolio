<?php

declare(strict_types=1);

namespace App\Services\ActivityLogs;

use App\Enums\ActivityLogType;
use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;

/**
 * Append-only audit logger (NFR9, SEC-LOG-04, BE-07).
 *
 * Called inside DB transactions for status changes, admin actions, and security events.
 */
class ActivityLogger
{
    public static function log(
        ActivityLogType|string $type,
        string $action,
        ?User $actor = null,
        ?Model $subject = null,
        ?string $before = null,
        ?string $after = null,
        ?string $reason = null,
        ?string $userAgent = null,
        ?string $subjectTypeOverride = null,
        ?int $subjectIdOverride = null,
    ): ActivityLog {
        $entry = new ActivityLog;
        $entry->actor_user_id = $actor?->id;
        $entry->type = $type instanceof ActivityLogType ? $type->value : $type;
        $entry->action = $action;
        $entry->subject_type = $subjectTypeOverride ?? ($subject ? $subject::class : null);
        $entry->subject_id = $subjectIdOverride ?? ($subject ? (int) $subject->getKey() : null);
        $entry->before_value = $before;
        $entry->after_value = $after;
        $entry->reason = $reason;
        $entry->user_agent = $userAgent !== null ? mb_substr($userAgent, 0, 255) : null;
        $entry->save();

        return $entry;
    }
}
