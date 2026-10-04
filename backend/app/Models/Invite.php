<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Invite extends Model
{
    use HasFactory;

    protected $table = 'invites';

    protected $fillable = [
        'note',
    ];

    protected $casts = [
        'id' => 'integer',
        'home_profile_id' => 'integer',
        'pet_id' => 'integer',
        'dismissed_at' => 'datetime',
    ];

    public function human(): BelongsTo
    {
        return $this->belongsTo(HomeProfile::class, 'home_profile_id');
    }

    public function homeProfile(): BelongsTo
    {
        return $this->belongsTo(HomeProfile::class, 'home_profile_id');
    }

    public function pet(): BelongsTo
    {
        return $this->belongsTo(Pet::class, 'pet_id');
    }

    public function scopeActive($query)
    {
        return $query->whereNull('dismissed_at');
    }

    public function isLive(): bool
    {
        return $this->dismissed_at === null;
    }
}
