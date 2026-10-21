<?php

namespace App\Models;

use App\Enums\PetStatus;
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

    /**
     * The invites the pet may still act on: not dismissed, to a pet that isn't Hired. An adopted pet can't apply
     * anywhere (proposal §5.5), so its invites stop counting without being marked dismissed, and they count again
     * if an admin cancels the adoption. An In Process pet's do count: they are usable once that request ends.
     */
    public function scopeActive($query)
    {
        return $query->whereNull('dismissed_at')
            ->whereHas('pet', fn ($pet) => $pet->where('status', '!=', PetStatus::AdoptedHired->value));
    }

    public function isLive(): bool
    {
        return $this->dismissed_at === null && $this->pet?->getStatusEnum() !== PetStatus::AdoptedHired;
    }
}
