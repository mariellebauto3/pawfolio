<?php

namespace App\Models;

use App\Enums\ActivityLevel;
use App\Enums\AnnouncementAudience;
use App\Enums\AcceptedSpecies;
use App\Enums\ActivityLogType;
use App\Enums\HoursAway;
use App\Enums\HomeType;
use App\Enums\OtherPetType;
use App\Enums\PetExperience;
use App\Enums\PetSex;
use App\Enums\PetSize;
use App\Enums\SpecialNeedsWillingness;
use App\Enums\PostType;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

/** @property int $id */
/** @property int $user_id */
/** @property string|null $full_name */
/** @property string|null $birthdate */
/** @property string|null $contact_number */
/** @property string|null $city */
/** @property string|null $province */
/** @property string|null $street_address */
/** @property string|null $headline */
/** @property string|null $about_home */
/** @property string|null $profile_photo_path */
/** @property string|null $cover_photo_path */
/** @property string|null $home_type */
/** @property string|null $outdoor_space */
/** @property string|null $activity_level */
/** @property string|null $hours_away */
/** @property string|null $pet_experience */
/** @property string|null $special_needs_willingness */
/** @property bool $is_open_to_adopt */
/** @property string|null $quiz_completed_at */
/** @property string|null $furparent_at */
/** @property \Illuminate\Support\Carbon|null $created_at */
/** @property \Illuminate\Support\Carbon|null $updated_at */

class HomeProfile extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    public const TABLE = 'home_profiles';

    protected $table = self::TABLE;

    protected $fillable = [
        'user_id',
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
        'quiz_completed_at',
        'furparent_at',
    ];

    protected $casts = [
        'id' => 'integer',
        'user_id' => 'integer',
        'birthdate' => 'date',
        'is_open_to_adopt' => 'boolean',
        'quiz_completed_at' => 'datetime',
        'furparent_at' => 'datetime',
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

    public function feedPosts(): HasMany
    {
        return $this->hasMany(Post::class)->where('type', PostType::ForHire);
    }

    public function adoptedPosts(): HasMany
    {
        return $this->hasMany(Post::class)->where('type', PostType::AdoptionStory);
    }

    public function adoption(): ?HasOne
    {
        return $this->hasOne(Adoption::class)->whereNotNull('adopted_at');
    }

    public function adoptions(): HasMany
    {
        return $this->hasMany(Adoption::class);
    }

    public function matchScore(): ?HasOne
    {
        return $this->hasOne(MatchScore::class);
    }

    public function requests(): HasMany
    {
        return $this->hasMany(AdoptionRequest::class);
    }

    public function meetAndGreetSlots(): HasMany
    {
        return $this->hasMany(MeetGreetSlot::class);
    }

    public function meetAndGreetBookings(): HasMany
    {
        return $this->hasMany(MeetAndGreet::class);
    }

    public function viewLogs(): HasMany
    {
        return $this->hasMany(ProfileView::class);
    }

    public function reports(): HasMany
    {
        return $this->hasMany(Report::class)->where('target_type', ReportTargetType::Profile);
    }

    public function announcement(): ?HasOne
    {
        return $this->hasOne(Announcement::class);
    }

    public function isOpenToAdopt(): bool
    {
        return (bool) $this->is_open_to_adopt;
    }
}
