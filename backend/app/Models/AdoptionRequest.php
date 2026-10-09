<?php

namespace App\Models;

use App\Enums\AdoptionRequestStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class AdoptionRequest extends Model
{
    use HasFactory;

    public const OPEN_STATUSES = [
        AdoptionRequestStatus::Sent->value,
        AdoptionRequestStatus::OnHold->value,
        AdoptionRequestStatus::Approved->value,
        AdoptionRequestStatus::MeetScheduled->value,
        AdoptionRequestStatus::AwaitingDecision->value,
    ];

    public const IN_PROCESS_STATUSES = [
        AdoptionRequestStatus::Approved->value,
        AdoptionRequestStatus::MeetScheduled->value,
        AdoptionRequestStatus::AwaitingDecision->value,
    ];

    public const CLOSED_STATUSES = [
        AdoptionRequestStatus::Adopted->value,
        AdoptionRequestStatus::Declined->value,
        AdoptionRequestStatus::NotAdopted->value,
        AdoptionRequestStatus::Withdrawn->value,
        AdoptionRequestStatus::Closed->value,
        AdoptionRequestStatus::Expired->value,
    ];

    protected $table = 'adoption_requests';

    protected $fillable = [
        'cover_letter',
        'caretaker_notes',
        'approval_message',
        'decline_reason',
        'decision_message',
        'withdraw_reason',
    ];

    protected $casts = [
        'id' => 'integer',
        'pet_id' => 'integer',
        'home_profile_id' => 'integer',
        'sent_at' => 'datetime',
        'expires_at' => 'datetime',
        'approved_at' => 'datetime',
        'meet_scheduled_at' => 'datetime',
        'awaiting_decision_at' => 'datetime',
        'overdue_flagged_at' => 'datetime',
        'closed_at' => 'datetime',
    ];

    public function pet(): BelongsTo
    {
        return $this->belongsTo(Pet::class);
    }

    public function homeProfile(): BelongsTo
    {
        return $this->belongsTo(HomeProfile::class);
    }

    public function meetAndGreets(): HasMany
    {
        return $this->hasMany(MeetAndGreet::class);
    }

    public function activeMeetAndGreet(): HasOne
    {
        return $this->hasOne(MeetAndGreet::class)->whereIn('status', ['booked', 'confirmed'])->latestOfMany();
    }

    public function latestMeetAndGreet(): HasOne
    {
        return $this->hasOne(MeetAndGreet::class)->latestOfMany();
    }

    public function adoption(): HasOne
    {
        return $this->hasOne(Adoption::class);
    }

    public function getStatus(): AdoptionRequestStatus
    {
        return $this->status instanceof AdoptionRequestStatus
            ? $this->status
            : (AdoptionRequestStatus::tryFrom((string) $this->status) ?: AdoptionRequestStatus::Sent);
    }

    public function isOpen(): bool
    {
        return in_array($this->getStatus()->value, self::OPEN_STATUSES, true);
    }

    public function isInProcess(): bool
    {
        return in_array($this->getStatus()->value, self::IN_PROCESS_STATUSES, true);
    }

    public function isClosed(): bool
    {
        return in_array($this->getStatus()->value, self::CLOSED_STATUSES, true);
    }

    /**
     * Whether the confirmed Meet & Greet's time is behind us, so the human's decision is open (§5.4, FR12). True
     * from that moment until the request ends: the scheduled job moves the request to Awaiting Decision within
     * minutes, and nobody waits on it to decide.
     */
    public function meetingHasPassed(): bool
    {
        $status = $this->getStatus();
        if ($status === AdoptionRequestStatus::AwaitingDecision) {
            return true;
        }
        if ($status !== AdoptionRequestStatus::MeetScheduled) {
            return false;
        }

        $startsAt = ($this->activeMeetAndGreet ?? $this->latestMeetAndGreet)?->slot?->starts_at;

        return $startsAt !== null && ! $startsAt->isFuture();
    }

    public function scopeOpen($query)
    {
        return $query->whereIn('status', self::OPEN_STATUSES);
    }

    public function scopeInProcess($query)
    {
        return $query->whereIn('status', self::IN_PROCESS_STATUSES);
    }

    public function scopeClosed($query)
    {
        return $query->whereIn('status', self::CLOSED_STATUSES);
    }

    public function scopeActive($query)
    {
        return $this->scopeOpen($query);
    }
}
