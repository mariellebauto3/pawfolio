<?php

namespace App\Models;

use App\Enums\ReportReason;
use App\Enums\ReportStatus;
use App\Enums\ReportTargetType;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Report extends Model
{
    protected $table = 'reports';

    protected $fillable = [
        'reporter_user_id',
        'target_type',
        'reported_user_id',
        'post_id',
        'comment_id',
        'reason',
        'details',
        'status',
        'report_action_id',
    ];

    protected $casts = [
        'id' => 'integer',
        'reporter_user_id' => 'integer',
        'reported_user_id' => 'integer',
        'post_id' => 'integer',
        'comment_id' => 'integer',
        'report_action_id' => 'integer',
    ];

    public function reporter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reporter_user_id');
    }

    public function reportedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reported_user_id');
    }

    public function post(): BelongsTo
    {
        return $this->belongsTo(Post::class);
    }

    public function comment(): BelongsTo
    {
        return $this->belongsTo(Comment::class);
    }

    public function reportAction(): BelongsTo
    {
        return $this->belongsTo(ReportAction::class, 'report_action_id');
    }

    public function getReason(): ReportReason
    {
        return ReportReason::tryFrom($this->reason) ?: ReportReason::SomethingElse;
    }

    public function getStatus(): ReportStatus
    {
        return ReportStatus::tryFrom($this->status) ?: ReportStatus::Open;
    }

    public function getTargetType(): ReportTargetType
    {
        return ReportTargetType::tryFrom($this->target_type) ?: ReportTargetType::Profile;
    }

    public function scopeOpen($query)
    {
        return $query->where('status', ReportStatus::Open);
    }
}
