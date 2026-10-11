<?php

namespace App\Models;

use App\Enums\AccountAction as AccountActionEnum;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AccountAction extends Model
{
    use HasFactory;

    protected $table = 'account_actions';

    protected $fillable = [
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

    public function getAction(): AccountActionEnum
    {
        return $this->action instanceof AccountActionEnum
            ? $this->action
            : (AccountActionEnum::tryFrom((string) $this->action) ?: AccountActionEnum::Deactivate);
    }
}
