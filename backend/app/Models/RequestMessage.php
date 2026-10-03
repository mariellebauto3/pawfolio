<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RequestMessage extends Model
{
    protected $table = 'request_messages';

    protected $fillable = [
        'adoption_request_id',
        'sender_user_id',
        'body',
    ];

    protected $casts = [
        'id' => 'integer',
        'adoption_request_id' => 'integer',
        'sender_user_id' => 'integer',
    ];

    public function request(): BelongsTo
    {
        return $this->belongsTo(AdoptionRequest::class, 'adoption_request_id');
    }

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_user_id');
    }
}
