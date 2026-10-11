<?php

namespace App\Models;

use App\Enums\DetailChangeRequestStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DetailChangeRequest extends Model
{
    use HasFactory;

    protected $table = 'detail_change_requests';

    protected $fillable = [
        'field',
        'new_value',
        'reason',
        'document_path',
    ];

    protected $casts = [
        'id' => 'integer',
        'user_id' => 'integer',
        'reviewed_by_user_id' => 'integer',
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

    public function scopePending($query)
    {
        return $query->where('status', DetailChangeRequestStatus::Pending->value);
    }

    public function scopeApproved($query)
    {
        return $query->where('status', DetailChangeRequestStatus::Approved->value);
    }

    public function scopeDenied($query)
    {
        return $query->where('status', DetailChangeRequestStatus::Denied->value);
    }
}
