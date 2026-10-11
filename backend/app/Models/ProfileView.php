<?php

namespace App\Models;

use App\Enums\ProfileViewSource;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProfileView extends Model
{
    use HasFactory;

    protected $table = 'profile_views';

    protected $fillable = [
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
        return ProfileViewSource::tryFrom((string) $this->source) ?: ProfileViewSource::Browse;
    }
}
