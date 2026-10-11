<?php

namespace App\Models;

use App\Enums\OtherPetType;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HomeProfileOtherPet extends Model
{
    protected $table = 'home_profile_other_pets';

    protected $fillable = [
        'pet_type',
    ];

    protected $casts = [
        'id' => 'integer',
        'home_profile_id' => 'integer',
        'pet_type' => OtherPetType::class,
    ];

    public function homeProfile(): BelongsTo
    {
        return $this->belongsTo(HomeProfile::class);
    }
}
