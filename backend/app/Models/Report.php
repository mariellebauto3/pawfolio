<?php

namespace App\Models;

use App\Enums\ReportReason;
use App\Enums\ReportStatus;
use App\Enums\ReportTargetType;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Report extends Model
{
    use HasFactory;

    /**
     * Another report (`r2`) on the item a report is about, in the same status: the same account, the same kind of
     * target and the same post or comment. Constants only, so it is safe inside raw SQL (SEC-INPUT-02).
     */
    public const SAME_ITEM = 'r2.reported_user_id = reports.reported_user_id AND r2.target_type = reports.target_type'
        .' AND COALESCE(r2.post_id, 0) = COALESCE(reports.post_id, 0)'
        .' AND COALESCE(r2.comment_id, 0) = COALESCE(reports.comment_id, 0)'
        .' AND r2.status = reports.status';

    /** One row per reported item: its latest report stands for the others on it (RP-03). */
    public function scopeLatestPerItem($query)
    {
        return $query->whereRaw('reports.id = (SELECT MAX(r2.id) FROM reports r2 WHERE '.self::SAME_ITEM.')');
    }

    protected $table = 'reports';

    protected $fillable = [
        'target_type',
        'reason',
        'details',
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
        return ReportReason::tryFrom((string) $this->reason) ?: ReportReason::SomethingElse;
    }

    public function getStatus(): ReportStatus
    {
        return ReportStatus::tryFrom((string) $this->status) ?: ReportStatus::Open;
    }

    public function getTargetType(): ReportTargetType
    {
        return ReportTargetType::tryFrom((string) $this->target_type) ?: ReportTargetType::Profile;
    }

    public function scopeOpen($query)
    {
        return $query->where('status', ReportStatus::Open->value);
    }

    public function scopeResolved($query)
    {
        return $query->where('status', ReportStatus::Resolved->value);
    }
}
