<?php

namespace App\Models;

use App\Enums\PetEnergyLevel;
use App\Enums\PetExperienceNeeded;
use App\Enums\PetGoodWith;
use App\Enums\PetSex;
use App\Enums\PetSize;
use App\Enums\PetSpaceNeeds;
use App\Enums\PetStatus;
use App\Enums\PetTimeAlone;
use App\Enums\PetSpecialNeed;
use App\Enums\PetSkill;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/** @property int $id */
/** @property int $user_id */
/** @property string|null $name */
/** @property string $species */
/** @property string|null $breed */
/** @property int|null $approximate_age_months */
/** @property string|null $sex */
/** @property string|null $size */
/** @property string|null $currently_at */
/** @property string|null $city */
/** @property string|null $province */
/** @property string|null $caretaker_name */
/** @property string|null $caretaker_contact_number */
/** @property string|null $bio */
/** @property string|null $energy_level */
/** @property string|null $good_with_kids */
/** @property string|null $good_with_dogs */
/** @property string|null $good_with_cats */
/** @property string|null $time_alone */
/** @property string|null $space_needs */
/** @property string|null $experience_needed */
/** @property string|null $health_notes */
/** @property string|null $cover_photo_path */
/** @property string $status */
/** @property string|null $published_at */
/** @property \Illuminate\Support\Carbon|null $created_at */
/** @property \Illuminate\Support\Carbon|null $updated_at */

class Pet extends Model
{
    use HasFactory;

    public const TABLE = 'pets';

    protected $table = self::TABLE;

    protected $fillable = [
        'user_id',
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
        'status',
        'published_at',
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
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function photos(): HasMany
    {
        return $this->hasMany(PetPhoto::class);
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

    public function adoption(): ?HasOne
    {
        return $this->hasOne(Adoption::class);
    }

    public function adoptions(): HasMany
    {
        return $this->hasMany(Adoption::class);
    }

    public function publishedAdoption(): ?HasOne
    {
        return $this->hasOne(Adoption::class)->whereNotNull('adopted_at');
    }

    public function scopeActiveForAdoption($query)
    {
        return $query->where('status', PetStatus::LookingForAHome)
            ->where('published_at', '<=', now())
            ->whereNull('cover_photo_path');
    }

    public function isPublished(): bool
    {
        return $this->status === PetStatus::LookingForAHome
            && $this->published_at !== null;
    }
}
