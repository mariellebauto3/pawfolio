<?php

namespace App\Models;

use App\Casts\EncryptedOrPlaintext;
use App\Enums\PetEnergyLevel;
use App\Enums\PetExperienceNeeded;
use App\Enums\PetGoodWith;
use App\Enums\PetSex;
use App\Enums\PetSize;
use App\Enums\PetSpaceNeeds;
use App\Enums\PetStatus;
use App\Enums\PetTimeAlone;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Pet extends Model
{
    use HasFactory;

    public const TABLE = 'pets';

    protected $table = self::TABLE;

    protected $fillable = [
        'name',
        'species',
        'breed',
        'approximate_age_months',
        'sex',
        'size',
        'currently_at',
        'city',
        'province',
        'caretaker_name',
        'caretaker_contact_number',
        'bio',
        'energy_level',
        'good_with_kids',
        'good_with_dogs',
        'good_with_cats',
        'time_alone',
        'space_needs',
        'experience_needed',
        'health_notes',
        'cover_photo_path',
    ];

    protected $casts = [
        'id' => 'integer',
        'user_id' => 'integer',
        'approximate_age_months' => 'integer',
        'sex' => PetSex::class,
        'size' => PetSize::class,
        'energy_level' => PetEnergyLevel::class,
        'good_with_kids' => PetGoodWith::class,
        'good_with_dogs' => PetGoodWith::class,
        'good_with_cats' => PetGoodWith::class,
        'time_alone' => PetTimeAlone::class,
        'space_needs' => PetSpaceNeeds::class,
        'experience_needed' => PetExperienceNeeded::class,
        'status' => PetStatus::class,
        'published_at' => 'datetime',
        'caretaker_contact_number' => EncryptedOrPlaintext::class,
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function photos(): HasMany
    {
        return $this->hasMany(PetPhoto::class)->orderBy('sort_order');
    }

    public function temperamentTags(): HasMany
    {
        return $this->hasMany(PetTemperamentTag::class);
    }

    public function skills(): HasMany
    {
        return $this->hasMany(PetSkillRow::class);
    }

    public function specialNeeds(): HasMany
    {
        return $this->hasMany(PetSpecialNeedRow::class);
    }

    public function vetRecords(): HasMany
    {
        return $this->hasMany(PetVetRecord::class);
    }

    public function adoptionRequests(): HasMany
    {
        return $this->hasMany(AdoptionRequest::class);
    }

    public function invites(): HasMany
    {
        return $this->hasMany(Invite::class);
    }

    public function matchScores(): HasMany
    {
        return $this->hasMany(MatchScore::class);
    }

    public function bookmarks(): HasMany
    {
        return $this->hasMany(Bookmark::class);
    }

    public function profileViews(): HasMany
    {
        return $this->hasMany(ProfileView::class);
    }

    public function adoption(): HasOne
    {
        return $this->hasOne(Adoption::class)->whereNull('link_removed_at');
    }

    public function adoptions(): HasMany
    {
        return $this->hasMany(Adoption::class);
    }

    public function publishedAdoption(): HasOne
    {
        return $this->hasOne(Adoption::class)->whereNotNull('adopted_at')->whereNull('link_removed_at');
    }

    public function resolutions(): HasMany
    {
        return $this->hasMany(AdoptionResolution::class);
    }

    public function scopeLookingForAHome($query)
    {
        return $query->where('status', PetStatus::LookingForAHome);
    }

    public function scopeActiveForAdoption($query)
    {
        return $query->where('status', PetStatus::LookingForAHome)
            ->whereNotNull('published_at');
    }

    public function getStatusEnum(): PetStatus
    {
        return $this->status instanceof PetStatus
            ? $this->status
            : (PetStatus::tryFrom((string) $this->status) ?: PetStatus::Draft);
    }

    public function getStatus(): PetStatus
    {
        return $this->getStatusEnum();
    }

    public function isPublished(): bool
    {
        return $this->getStatusEnum() === PetStatus::LookingForAHome
            && $this->published_at !== null;
    }
}
