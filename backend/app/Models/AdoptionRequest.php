<?php

namespace App\Models;

use App\Enums\AdoptionRequestDeclineReason;
use App\Enums\AdoptionRequestStatus;
use App\Enums\AdoptionRequestWithdrawReason;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AdoptionRequest extends Model
{
    protected $table = 'adoption_requests';

    protected $fillable = [
        'pet_id',
        'home_profile_id',
        'status',
        'cover_letter',
        'caretaker_notes',
        'approval_message',
        'decline_reason',
        'decision_message',
        'withdraw_reason',
        'sent_at',
        'expires_at',
        'approved_at',
        'meet_scheduled_at',
        'awaiting_decision_at',
        'overdue_flagged_at',
        'closed_at',
    ];

    protected $casts = [
        'id' => 'integer',
        'pet_id' => 'integer',
        'home_profile_id' => 'integer',
    ];

    public function pet(): BelongsTo
    {
        return $this->belongsTo(Pet::class);
    }

    public function human(): BelongsTo
    {
        return $this->belongsTo(HomeProfile::class, 'home_profile_id');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(RequestMessage::class);
    }

    public function meetAndGreetBookings(): HasMany
    {
        return $this->hasMany(MeetAndGreet::class);
    }

    public function adoptions(): HasMany
    {
        return $this->hasMany(Adoption::class);
    }

    public function resolution(): ?HasOne
    {
        return $this->hasOne(AdoptionResolution::class);
    }

    public function scopeOpen($query)
    {
        return $query->whereIn('status', [
            AdoptionRequestStatus::Sent,
            AdoptionRequestStatus::OnHold,
            AdoptionRequestStatus::Approved,
            AdoptionRequestStatus::MeetScheduled,
            AdoptionRequestStatus::AwaitingDecision,
        ]);
    }

    public function scopeSent($query)
    {
        return $query->where('status', AdoptionRequestStatus::Sent);
    }

    public function scopeApproved($query)
    {
        return $query->where('status', AdoptionRequestStatus::Approved);
    }

    public function scopeAwaitingDecision($query)
    {
        return $query->where('status', AdoptionRequestStatus::AwaitingDecision);
    }

    public function scopeExpired($query)
    {
        return $query->where('status', AdoptionRequestStatus::Expired);
    }

    public function getStatus(): AdoptionRequestStatus
    {
        return AdoptionRequestStatus::tryFrom($this->status) ?: AdoptionRequestStatus::Sent;
    }

    public function getDeclineReason(): ?AdoptionRequestDeclineReason
    {
        return AdoptionRequestDeclineReason::tryFrom($this->decline_reason);
    }

    public function getWithdrawReason(): ?AdoptionRequestWithdrawReason
    {
        return AdoptionRequestWithdrawReason::tryFrom($this->withdraw_reason);
    }

    public function isOpen(): bool
    {
        return $this->getStatus() === AdoptionRequestStatus::Sent
            || $this->getStatus() === AdoptionRequestStatus::OnHold
            || $this->getStatus() === AdoptionRequestStatus::Approved
            || $this->getStatus() === AdoptionRequestStatus::MeetScheduled
            || $this->getStatus() === AdoptionRequestStatus::AwaitingDecision;
    }
}
