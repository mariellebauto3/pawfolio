<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Bookmark extends Model
{
    use HasFactory;

    protected $table = 'bookmarks';

    protected $fillable = [];

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

    public function isPetBookmark(): bool
    {
        return $this->pet_id !== null;
    }

    public function isHomeBookmark(): bool
    {
        return $this->home_profile_id !== null;
    }
}
