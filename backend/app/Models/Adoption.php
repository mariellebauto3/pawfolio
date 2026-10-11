<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Adoption extends Model
{
    use HasFactory;

    protected $table = 'adoptions';

    protected $fillable = [];

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

    public function request(): BelongsTo
    {
        return $this->belongsTo(AdoptionRequest::class, 'adoption_request_id');
    }

    public function isActiveLink(): bool
    {
        return $this->link_removed_at === null;
    }

    public function scopeActive($query)
    {
        return $query->whereNull('link_removed_at');
    }
}
