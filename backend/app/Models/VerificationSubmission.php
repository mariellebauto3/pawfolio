<?php

namespace App\Models;

use App\Enums\VerificationSubmissionStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class VerificationSubmission extends Model
{
    use HasFactory;

    protected $table = 'verification_submissions';

    protected $fillable = [
        'denial_reason',
        'message_to_owner',
    ];

    protected $casts = [
        'id' => 'integer',
        'user_id' => 'integer',
        'reviewed_by_user_id' => 'integer',
        'submitted_at' => 'datetime',
        'reviewed_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function reviewedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by_user_id');
    }

    public function documents(): HasMany
    {
        return $this->hasMany(VerificationDocument::class, 'verification_submission_id');
    }

    public function scopePending($query)
    {
        return $query->where('status', VerificationSubmissionStatus::Pending);
    }

    public function scopeApproved($query)
    {
        return $query->where('status', VerificationSubmissionStatus::Approved);
    }

    public function scopeDenied($query)
    {
        return $query->where('status', VerificationSubmissionStatus::Denied);
    }

    public function scopeAwaitingReview($query)
    {
        return $query->where('status', VerificationSubmissionStatus::Pending)
            ->orderBy('submitted_at');
    }
}
