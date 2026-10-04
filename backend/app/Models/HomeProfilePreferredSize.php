<?php

namespace App\Models;

use App\Enums\PreferredSize;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HomeProfilePreferredSize extends Model
{
    protected $table = 'home_profile_preferred_sizes';

    protected $fillable = [
        'size',
    ];

    protected $casts = [
        'id' => 'integer',
        'home_profile_id' => 'integer',
        'size' => PreferredSize::class,
    ];

    public function homeProfile(): BelongsTo
    {
        return $this->belongsTo(HomeProfile::class);
    }
}
