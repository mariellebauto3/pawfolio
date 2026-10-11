<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MatchScore extends Model
{
    use HasFactory;

    protected $table = 'match_scores';

    protected $fillable = [
        'score',
        'activity_points',
        'hours_away_points',
        'space_points',
        'experience_points',
        'size_age_points',
        'compatibility_points',
        'special_needs_points',
    ];

    protected $casts = [
        'id' => 'integer',
        'pet_id' => 'integer',
        'home_profile_id' => 'integer',
        'score' => 'integer',
        'activity_points' => 'integer',
        'hours_away_points' => 'integer',
        'space_points' => 'integer',
        'experience_points' => 'integer',
        'size_age_points' => 'integer',
        'compatibility_points' => 'integer',
        'special_needs_points' => 'integer',
        'calculated_at' => 'datetime',
    ];

    public function pet(): BelongsTo
    {
        return $this->belongsTo(Pet::class);
    }

    public function homeProfile(): BelongsTo
    {
        return $this->belongsTo(HomeProfile::class);
    }

    public function scopeForPet($query, int $petId)
    {
        return $query->where('pet_id', $petId);
    }

    public function scopeForHome($query, int $homeProfileId)
    {
        return $query->where('home_profile_id', $homeProfileId);
    }
}
