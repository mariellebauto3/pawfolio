<?php

namespace App\Models;

use App\Enums\HouseholdMember;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HomeProfileHouseholdMember extends Model
{
    protected $table = 'home_profile_household_members';

    protected $fillable = [
        'home_profile_id',
        'member',
    ];

    protected $casts = [
        'id' => 'integer',
        'home_profile_id' => 'integer',
        'member' => HouseholdMember::class,
    ];

    public function homeProfile(): BelongsTo
    {
        return $this->belongsTo(HomeProfile::class);
    }
}
