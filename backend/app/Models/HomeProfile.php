<?php

namespace App\Models;

use App\Casts\EncryptedOrPlaintext;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;
use Illuminate\Database\Eloquent\Relations\HasOne;

class HomeProfile extends Model
{
    use HasFactory;

    public const TABLE = 'home_profiles';

    protected $table = self::TABLE;

    protected $fillable = [
        'full_name',
        'birthdate',
        'contact_number',
        'city',
        'province',
        'street_address',
        'headline',
        'about_home',
        'profile_photo_path',
        'cover_photo_path',
        'home_type',
        'outdoor_space',
        'activity_level',
        'hours_away',
        'pet_experience',
        'special_needs_willingness',
        'is_open_to_adopt',
    ];

    protected $casts = [
        'id' => 'integer',
        'user_id' => 'integer',
        'birthdate' => 'date:Y-m-d',
        'is_open_to_adopt' => 'boolean',
        'quiz_completed_at' => 'datetime',
        'furparent_at' => 'datetime',
        'contact_number' => EncryptedOrPlaintext::class,
        'street_address' => EncryptedOrPlaintext::class,
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function householdMembers(): HasMany
    {
        return $this->hasMany(HomeProfileHouseholdMember::class);
    }

    public function otherPets(): HasMany
    {
        return $this->hasMany(HomeProfileOtherPet::class);
    }

    public function acceptedSpecies(): HasMany
    {
        return $this->hasMany(HomeProfileAcceptedSpecies::class);
    }

    public function preferredSizes(): HasMany
    {
        return $this->hasMany(HomeProfilePreferredSize::class);
    }

    public function preferredAges(): HasMany
    {
        return $this->hasMany(HomeProfilePreferredAge::class);
    }

    public function adoption(): HasOne
    {
        return $this->hasOne(Adoption::class)->whereNotNull('adopted_at')->whereNull('link_removed_at');
    }

    public function adoptions(): HasMany
    {
        return $this->hasMany(Adoption::class);
    }

    public function activeAdoptions(): HasMany
    {
        return $this->hasMany(Adoption::class)->whereNull('link_removed_at');
    }

    public function matchScores(): HasMany
    {
        return $this->hasMany(MatchScore::class);
    }

    public function requests(): HasMany
    {
        return $this->hasMany(AdoptionRequest::class);
    }

    public function adoptionRequests(): HasMany
    {
        return $this->hasMany(AdoptionRequest::class);
    }

    public function invites(): HasMany
    {
        return $this->hasMany(Invite::class);
    }

    public function bookmarks(): HasMany
    {
        return $this->hasMany(Bookmark::class);
    }

    public function meetAndGreetSlots(): HasMany
    {
        return $this->hasMany(MeetGreetSlot::class);
    }

    public function meetAndGreetBookings(): HasManyThrough
    {
        return $this->hasManyThrough(MeetAndGreet::class, AdoptionRequest::class);
    }

    public function viewLogs(): HasMany
    {
        return $this->hasMany(ProfileView::class);
    }

    public function profileViews(): HasMany
    {
        return $this->hasMany(ProfileView::class);
    }

    public function scopeOpenToAdopt($query)
    {
        return $query->where('is_open_to_adopt', true);
    }

    public function isOpenToAdopt(): bool
    {
        return (bool) $this->is_open_to_adopt;
    }

    public function isFurparent(): bool
    {
        return $this->furparent_at !== null;
    }

    public function hasCompletedQuiz(): bool
    {
        return $this->quiz_completed_at !== null;
    }
}
