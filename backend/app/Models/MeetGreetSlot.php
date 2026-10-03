<?php

namespace App\Models;

use App\Enums\MeetGreetPlaceType;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MeetGreetSlot extends Model
{
    protected $table = 'meet_greet_slots';

    protected $fillable = [
        'home_profile_id',
        'starts_at',
        'place_type',
        'place_details',
        'deleted_at',
    ];

    protected $casts = [
        'id' => 'integer',
        'home_profile_id' => 'integer',
    ];

    public function homeProfile(): BelongsTo
    {
        return $this->belongsTo(HomeProfile::class);
    }

    public function placeType(): MeetGreetPlaceType
    {
        return MeetGreetPlaceType::tryFrom($this->place_type) ?: MeetGreetPlaceType::PublicSpot;
    }

    public function scopeAvailable($query)
    {
        return $query->where('deleted_at', null);
    }
}
