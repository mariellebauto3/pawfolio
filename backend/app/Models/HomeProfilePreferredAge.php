<?php

namespace App\Models;

use App\Enums\PreferredAgeGroup;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HomeProfilePreferredAge extends Model
{
    protected $table = 'home_profile_preferred_ages';

    protected $fillable = [
        'home_profile_id',
        'age_group',
    ];

    protected $casts = [
        'id' => 'integer',
        'home_profile_id' => 'integer',
        'age_group' => PreferredAgeGroup::class,
    ];

    public function homeProfile(): BelongsTo
    {
        return $this->belongsTo(HomeProfile::class);
    }
}
