<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RequestMessage extends Model
{
    use HasFactory;

    protected $table = 'request_messages';

    protected $fillable = [
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
