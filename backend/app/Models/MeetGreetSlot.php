<?php

namespace App\Models;

use App\Enums\MeetGreetPlaceType;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MeetGreetSlot extends Model
{
    use HasFactory;

    protected $table = 'meet_greet_slots';

    protected $fillable = [
        'starts_at',
        'place_type',
        'place_details',
    ];

    protected $casts = [
        'id' => 'integer',
        'home_profile_id' => 'integer',
        'starts_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function homeProfile(): BelongsTo
    {
        return $this->belongsTo(HomeProfile::class);
    }

    public function bookings(): HasMany
    {
        return $this->hasMany(MeetAndGreet::class, 'meet_greet_slot_id');
    }

    public function activeBooking(): ?MeetAndGreet
    {
        return $this->bookings()->whereIn('status', ['booked', 'confirmed'])->first();
    }

    public function placeType(): MeetGreetPlaceType
    {
        return MeetGreetPlaceType::tryFrom((string) $this->place_type) ?: MeetGreetPlaceType::PublicSpot;
    }

    public function scopeAvailable($query)
    {
        return $query->whereNull('deleted_at');
    }
}
