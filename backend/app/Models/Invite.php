<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Invite extends Model
{
    protected $table = 'invites';

    protected $fillable = [
        'home_profile_id',
        'pet_id',
        'note',
        'dismissed_at',
    ];

    protected $casts = [
        'id' => 'integer',
        'home_profile_id' => 'integer',
        'pet_id' => 'integer',
    ];

    public function human(): BelongsTo
    {
        return $this->belongsTo(HomeProfile::class, 'home_profile_id');
    }

    public function pet(): BelongsTo
    {
        return $this->belongsTo(Pet::class, 'pet_id');
    }

    public function isLive(): bool
    {
        return $this->dismissed_at === null;
    }
}
