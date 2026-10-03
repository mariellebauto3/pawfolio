<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Bookmark extends Model
{
    protected $table = 'bookmarks';

    protected $fillable = [
        'user_id',
        'pet_id',
        'home_profile_id',
    ];

    protected $casts = [
        'id' => 'integer',
        'user_id' => 'integer',
        'pet_id' => 'integer',
        'home_profile_id' => 'integer',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function pet(): BelongsTo
    {
        return $this->belongsTo(Pet::class);
    }

    public function homeProfile(): BelongsTo
    {
        return $this->belongsTo(HomeProfile::class);
    }

    public function isOnPet(): bool
    {
        return $this->pet_id !== null;
    }

    public function isOnHome(): bool
    {
        return $this->home_profile_id !== null;
    }
}
