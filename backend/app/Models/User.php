<?php

namespace App\Models;

use App\Enums\AccountStatus;
use App\Enums\Role;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * `role` and `status` are never fillable: they are set only by the system
     * or by admin actions (FR27, SEC-INPUT-04).
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
    ];

    /** @var list<string> */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'role' => Role::class,
            'status' => AccountStatus::class,
            'terms_accepted_at' => 'datetime',
        ];
    }

    public function getRole(): Role
    {
        return $this->role instanceof Role
            ? $this->role
            : (Role::tryFrom((string) $this->role) ?: Role::Human);
    }

    public function getStatus(): AccountStatus
    {
        return $this->status instanceof AccountStatus
            ? $this->status
            : (AccountStatus::tryFrom((string) $this->status) ?: AccountStatus::PendingVerification);
    }

    public function isPet(): bool
    {
        return $this->getRole() === Role::Pet;
    }

    public function isHuman(): bool
    {
        return $this->getRole() === Role::Human;
    }

    public function isAdmin(): bool
    {
        return $this->getRole() === Role::Admin;
    }

    public function isActive(): bool
    {
        return $this->getStatus() === AccountStatus::Active;
    }

    public function isPendingVerification(): bool
    {
        return $this->getStatus() === AccountStatus::PendingVerification;
    }

    public function isDenied(): bool
    {
        return $this->getStatus() === AccountStatus::Denied;
    }

    public function isSuspended(): bool
    {
        return $this->getStatus() === AccountStatus::Suspended;
    }

    public function isDeactivated(): bool
    {
        return $this->getStatus() === AccountStatus::Deactivated;
    }

    public function displayName(): string
    {
        return match ($this->getRole()) {
            Role::Pet => $this->pet?->name ?? $this->name ?? '',
            Role::Human => $this->homeProfile?->full_name ?? $this->name ?? '',
            Role::Admin => $this->name ?? '',
        };
    }

    public function getDisplayNameAttribute(): string
    {
        return $this->displayName();
    }

    public function profileId(): ?int
    {
        return match ($this->getRole()) {
            Role::Pet => $this->pet?->id,
            Role::Human => $this->homeProfile?->id,
            Role::Admin => null,
        };
    }

    public function avatarUrl(): ?string
    {
        return match ($this->getRole()) {
            Role::Pet => ($first = $this->pet?->photos()->orderBy('sort_order')->first())
                ? Storage::disk('public')->url($first->file_path)
                : null,
            Role::Human => $this->homeProfile?->profile_photo_path
                ? Storage::disk('public')->url($this->homeProfile->profile_photo_path)
                : null,
            Role::Admin => null,
        };
    }

    public function pet(): HasOne
    {
        return $this->hasOne(Pet::class);
    }

    public function homeProfile(): HasOne
    {
        return $this->hasOne(HomeProfile::class);
    }

    public function verificationSubmission(): HasOne
    {
        return $this->hasOne(VerificationSubmission::class)->latestOfMany('submitted_at');
    }

    public function verificationSubmissions(): HasMany
    {
        return $this->hasMany(VerificationSubmission::class);
    }

    public function latestVerificationSubmission(): HasOne
    {
        return $this->hasOne(VerificationSubmission::class)->latestOfMany('submitted_at');
    }

    public function verificationDocuments(): HasManyThrough
    {
        return $this->hasManyThrough(VerificationDocument::class, VerificationSubmission::class);
    }

    public function accountActions(): HasMany
    {
        return $this->hasMany(AccountAction::class);
    }

    public function bookmarks(): HasMany
    {
        return $this->hasMany(Bookmark::class);
    }

    public function profileViews(): HasMany
    {
        return $this->hasMany(ProfileView::class, 'viewer_user_id');
    }

    public function posts(): HasMany
    {
        return $this->hasMany(Post::class, 'author_user_id');
    }

    public function comments(): HasMany
    {
        return $this->hasMany(Comment::class);
    }

    public function reactions(): HasMany
    {
        return $this->hasMany(Reaction::class);
    }

    public function reportsFiled(): HasMany
    {
        return $this->hasMany(Report::class, 'reporter_user_id');
    }

    public function reportsAgainst(): HasMany
    {
        return $this->hasMany(Report::class, 'reported_user_id');
    }

    public function reportActions(): HasMany
    {
        return $this->hasMany(ReportAction::class, 'admin_user_id');
    }

    public function detailChangeRequests(): HasMany
    {
        return $this->hasMany(DetailChangeRequest::class);
    }

    public function announcements(): HasMany
    {
        return $this->hasMany(Announcement::class, 'admin_user_id');
    }

    public function notifications(): HasMany
    {
        return $this->hasMany(Notification::class);
    }

    public function notificationPreference(): HasOne
    {
        return $this->hasOne(NotificationPreference::class);
    }

    public function notificationPreferences(): HasOne
    {
        return $this->hasOne(NotificationPreference::class);
    }

    public function createNotificationPreference(): NotificationPreference
    {
        return $this->notificationPreference()->create([
            'requests_and_invites' => true,
            'meet_and_greets' => true,
            'post_activity' => true,
            'announcements' => true,
        ]);
    }

    public function activityLogs(): HasMany
    {
        return $this->hasMany(ActivityLog::class, 'actor_user_id');
    }
}
