<?php

namespace App\Models;

use App\Enums\AccountStatus;
use App\Enums\Role;
use Illuminate\Contracts\Auth\Authenticatable as UserAuthenticatable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
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

    public function pet(): HasOne
    {
        return $this->hasOne(Pet::class);
    }

    public function homeProfile(): HasOne
    {
        return $this->hasOne(HomeProfile::class);
    }

    // ── verification & admin flows ──────────────────────────────────────────────

    public function verificationSubmission(): ?HasOne
    {
        return $this->hasOne(VerificationSubmission::class);
    }

    public function verificationDocuments(): HasMany
    {
        return $this->hasMany(VerificationDocument::class);
    }

    public function detailChangeRequests(): HasMany
    {
        return $this->hasMany(DetailChangeRequest::class);
    }

    public function accountActions(): HasMany
    {
        return $this->hasMany(AccountAction::class);
    }

    public function notificationPreferences(): HasOne
    {
        return $this->hasOne(NotificationPreference::class);
    }

    // ── adoption & Meet & Greet ─────────────────────────────────────────────────

    public function adoptionRequests(): HasMany
    {
        return $this->hasMany(AdoptionRequest::class);
    }

    public function meetGreetSlots(): HasMany
    {
        return $this->hasMany(MeetGreetSlot::class);
    }

    public function meetAndGreetBookings(): HasMany
    {
        return $this->hasMany(MeetAndGreet::class);
    }

    public function adoptions(): HasMany
    {
        return $this->hasMany(Adoption::class);
    }

    public function adoptionResolution(): ?HasOne
    {
        return $this->hasOne(AdoptionResolution::class);
    }

    // ── discovery, matching, bookmarks, views ───────────────────────────────────

    public function invitations(): HasMany
    {
        return $this->hasMany(Invite::class);
    }

    public function matchScore(): ?HasOne
    {
        return $this->hasOne(MatchScore::class);
    }

    public function bookmarks(): HasMany
    {
        return $this->hasMany(Bookmark::class);
    }

    public function profileViews(): HasMany
    {
        return $this->hasMany(ProfileView::class);
    }

    // ── community feed ──────────────────────────────────────────────────────────

    public function feedPosts(): HasMany
    {
        return $this->hasMany(Post::class)->where('type', PostType::Post);
    }

    public function adoptionStories(): HasMany
    {
        return $this->hasMany(Post::class)->where('type', PostType::AdoptionStory);
    }

    public function comments(): HasMany
    {
        return $this->hasMany(Comment::class);
    }

    public function reactions(): HasMany
    {
        return $this->hasMany(Reaction::class);
    }

    // ── reporting & moderation ─────────────────────────────────────────────────

    public function reports(): HasMany
    {
        return $this->hasMany(Report::class)->where('target_type', ReportTargetType::Account);
    }

    public function reportActions(): HasMany
    {
        return $this->hasMany(ReportAction::class);
    }

    // ── notifications & announcements ───────────────────────────────────────────

    public function notifications(): HasMany
    {
        return $this->hasMany(Notification::class);
    }

    public function announcements(): HasMany
    {
        return $this->hasMany(Announcement::class);
    }

    public function activityLogs(): HasMany
    {
        return $this->hasMany(ActivityLog::class);
    }

    public function activityLog(): ?HasOne
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
    /** Active accounts can use the platform (proposal �5.1, SEC-AUTHZ-06). */
    public function isActive(): bool
    {
        return $this->status === AccountStatus::Active;
    }

    public function getNotificationPreferenceAttribute(): ?NotificationPreference
    {
        return $this->notificationPreferences;
    }

    public function createNotificationPreference(): NotificationPreference
    {
        return $this->notificationPreferences()->create([
            'requests_and_invites' => true,
            'meet_and_greets' => true,
            'post_activity' => true,
            'announcements' => true,
        ]);
    }
}
