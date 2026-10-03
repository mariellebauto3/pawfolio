<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Adoption extends Model
{
    protected $table = 'adoptions';

    protected $fillable = [
        'pet_id',
        'home_profile_id',
        'adoption_request_id',
        'adopted_at',
        'link_removed_at',
    ];

    protected $casts = [
        'id' => 'integer',
        'pet_id' => 'integer',
        'home_profile_id' => 'integer',
        'adoption_request_id' => 'integer',
        'adopted_at' => 'datetime',
        'link_removed_at' => 'datetime',
    ];

    public function pet(): BelongsTo
    {
        return $this->belongsTo(Pet::class);
    }

    public function homeProfile(): BelongsTo
    {
        return $this->belongsTo(HomeProfile::class);
    }

    public function adoptionRequest(): BelongsTo
    {
        return $this->belongsTo(AdoptionRequest::class, 'adoption_request_id');
    }

    public function isActive(): bool
    {
        return $this->link_removed_at === null;
    }
}
