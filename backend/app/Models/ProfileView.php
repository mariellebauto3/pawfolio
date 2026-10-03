<?php

namespace App\Models;

use App\Enums\ProfileViewSource;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProfileView extends Model
{
    protected $table = 'profile_views';

    protected $fillable = [
        'viewer_user_id',
        'pet_id',
        'home_profile_id',
        'source',
    ];

    protected $casts = [
        'id' => 'integer',
        'viewer_user_id' => 'integer',
        'pet_id' => 'integer',
        'home_profile_id' => 'integer',
    ];

    public function viewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'viewer_user_id');
    }

    public function pet(): BelongsTo
    {
        return $this->belongsTo(Pet::class);
    }

    public function homeProfile(): BelongsTo
    {
        return $this->belongsTo(HomeProfile::class);
    }

    public function source(): ProfileViewSource
    {
        return ProfileViewSource::tryFrom($this->source) ?: ProfileViewSource::Browse;
    }
}
