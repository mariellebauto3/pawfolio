<?php

namespace App\Models;

use App\Enums\AccountStatus;
use App\Enums\Role;
use Database\Factories\UserFactory;
use Illuminate\Contracts\Auth\Authenticatable as UserAuthenticatable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

/**
 * One account per Pet, Human or Admin (ERD §3, proposal §2).
 *
 * Status and role are set by the system / admin flows only — never through
 * a sign-in or member request (SEC-INPUT-04, FR27). The sign-in endpoint
 * reads the account and returns the shape in docs/api/auth.md.
 */
class User extends Authenticatable implements UserAuthenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'password',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'role' => Role::class,
            'status' => AccountStatus::class,
            'terms_accepted_at' => 'datetime',
        ];
    }

    // ── role-shape relationships ────────────────────────────────────────────────

    public function pet(): \Illuminate\Database\Eloquent\Relations\HasOne
    {
        return $this->hasOne(Pet::class);
    }

    public function homeProfile(): \Illuminate\Database\Eloquent\Relations\HasOne
    {
        return $this->hasOne(HomeProfile::class);
    }

    // ── verification & admin flows ──────────────────────────────────────────────

    public function verificationSubmission(): ?\Illuminate\Database\Eloquent\Relations\HasOne
    {
        return $this->hasOne(VerificationSubmission::class);
    }

    public function verificationDocuments(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(VerificationDocument::class);
    }

    public function detailChangeRequests(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(DetailChangeRequest::class);
    }

    public function accountActions(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(AccountAction::class);
    }

    public function notificationPreferences(): \Illuminate\Database\Eloquent\Relations\HasOne
    {
        return $this->hasOne(NotificationPreference::class);
    }

    // ── adoption & Meet & Greet ─────────────────────────────────────────────────

    public function adoptionRequests(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(AdoptionRequest::class);
    }

    public function meetGreetSlots(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(MeetGreetSlot::class);
    }

    public function meetAndGreetBookings(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(MeetAndGreet::class);
    }

    public function adoptions(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(Adoption::class);
    }

    public function adoptionResolution(): ?\Illuminate\Database\Eloquent\Relations\HasOne
    {
        return $this->hasOne(AdoptionResolution::class);
    }

    // ── discovery, matching, bookmarks, views ───────────────────────────────────

    public function invitations(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(Invite::class);
    }

    public function matchScore(): ?\Illuminate\Database\Eloquent\Relations\HasOne
    {
        return $this->hasOne(MatchScore::class);
    }

    public function bookmarks(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(Bookmark::class);
    }

    public function profileViews(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(ProfileView::class);
    }

    // ── community feed ──────────────────────────────────────────────────────────

    public function feedPosts(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(Post::class)->where('type', PostType::Post);
    }

    public function adoptionStories(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(Post::class)->where('type', PostType::AdoptionStory);
    }

    public function comments(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(Comment::class);
    }

    public function reactions(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(Reaction::class);
    }

    // ── reporting & moderation ─────────────────────────────────────────────────

    public function reports(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(Report::class)->where('target_type', ReportTargetType::Account);
    }

    public function reportActions(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(ReportAction::class);
    }

    // ── notifications & announcements ───────────────────────────────────────────

    public function notifications(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(\Illuminate\Notifications\DatabaseNotification::class);
    }

    public function announcements(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(Announcement::class);
    }

    public function activityLogs(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(ActivityLog::class);
    }

    public function activityLog(): ?\Illuminate\Database\Eloquent\Relations\HasOne
    {
        return $this->hasOne(ActivityLog::class);
    }

    // ── display helpers ─────────────────────────────────────────────────────────

    /** Display name for the /auth/me shape: pet name, human full name, or admin name. */
    public function displayName(): string
    {
        return match ($this->role) {
            Role::Pet => $this->pet?->name ?? $this->name,
            Role::Human => $this->homeProfile?->full_name ?? $this->name,
            Role::Admin => $this->name,
        };
    }

    /** profile_id for the /auth/me shape: pet id, home profile id, or null for admins. */
    public function profileId(): ?int
    {
        return match ($this->role) {
            Role::Pet => $this->pet?->id,
            Role::Human => $this->homeProfile?->id,
            Role::Admin => null,
        };
    }

    /** Active accounts can use the platform (proposal §5.1, SEC-AUTHZ-06). */
    public function isActive(): bool
    {
        return $this->status === AccountStatus::Active;
    }
}
