<?php

namespace App\Models;

use App\Enums\AccountAction;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AccountAction extends Model
{
    protected $table = 'account_actions';

    protected $fillable = [
        'user_id',
        'performed_by_user_id',
        'action',
        'reason',
    ];

    protected $casts = [
        'id' => 'integer',
        'user_id' => 'integer',
        'performed_by_user_id' => 'integer',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function performedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'performed_by_user_id');
    }

    public function scopeCreatedSince($query, $date)
    {
        return $query->where('created_at', '>=', $date);
    }

    public function getAction(): AccountAction
    {
        return AccountAction::tryFrom($this->action) ?: AccountAction::Deactivate;
    }
}
