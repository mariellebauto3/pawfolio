<?php

namespace App\Models;

use App\Enums\ReportAction as ReportActionEnum;
use App\Enums\ReportTargetType;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReportAction extends Model
{
    protected $table = 'report_actions';

    protected $fillable = [
        'admin_user_id',
        'target_type',
        'reported_user_id',
        'post_id',
        'comment_id',
        'action',
        'reason',
        'notify_reporters',
    ];

    protected $casts = [
        'id' => 'integer',
        'admin_user_id' => 'integer',
        'reported_user_id' => 'integer',
        'post_id' => 'integer',
        'comment_id' => 'integer',
        'notify_reporters' => 'boolean',
    ];

    public function admin(): BelongsTo
    {
        return $this->belongsTo(User::class, 'admin_user_id');
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

    public function getAction(): ReportActionEnum
    {
        return ReportActionEnum::tryFrom($this->action) ?: ReportActionEnum::Dismiss;
    }

    public function getTargetType(): ReportTargetType
    {
        return ReportTargetType::tryFrom($this->target_type) ?: ReportTargetType::Profile;
    }
}
