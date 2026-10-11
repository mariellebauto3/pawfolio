<?php

namespace App\Models;

use App\Enums\ReportAction as ReportActionEnum;
use App\Enums\ReportTargetType;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ReportAction extends Model
{
    use HasFactory;

    protected $table = 'report_actions';

    protected $fillable = [
        'target_type',
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

    public function reports(): HasMany
    {
        return $this->hasMany(Report::class, 'report_action_id');
    }

    public function getAction(): ReportActionEnum
    {
        return ReportActionEnum::tryFrom((string) $this->action) ?: ReportActionEnum::Dismiss;
    }

    public function getTargetType(): ReportTargetType
    {
        return ReportTargetType::tryFrom((string) $this->target_type) ?: ReportTargetType::Profile;
    }
}
