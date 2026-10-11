<?php

namespace App\Models;

use App\Enums\AcceptedSpecies;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HomeProfileAcceptedSpecies extends Model
{
    protected $table = 'home_profile_accepted_species';

    protected $fillable = [
        'species',
    ];

    protected $casts = [
        'id' => 'integer',
        'home_profile_id' => 'integer',
        'species' => AcceptedSpecies::class,
    ];

    public function homeProfile(): BelongsTo
    {
        return $this->belongsTo(HomeProfile::class);
    }
}
