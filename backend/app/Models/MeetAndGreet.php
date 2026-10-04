<?php

namespace App\Models;

use App\Enums\MeetAndGreetEndReason;
use App\Enums\MeetAndGreetStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MeetAndGreet extends Model
{
    use HasFactory;

    protected $table = 'meet_and_greets';

    protected $fillable = [
        'end_reason',
        'end_details',
    ];

    protected $casts = [
        'id' => 'integer',
        'adoption_request_id' => 'integer',
        'meet_greet_slot_id' => 'integer',
        'ended_by_user_id' => 'integer',
        'proposed_slot_id' => 'integer',
        'booked_at' => 'datetime',
        'confirmed_at' => 'datetime',
        'ended_at' => 'datetime',
    ];

    public function request(): BelongsTo
    {
        return $this->belongsTo(AdoptionRequest::class, 'adoption_request_id');
    }

    public function slot(): BelongsTo
    {
        return $this->belongsTo(MeetGreetSlot::class, 'meet_greet_slot_id');
    }

    public function endedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'ended_by_user_id');
    }

    public function proposedSlot(): BelongsTo
    {
        return $this->belongsTo(MeetGreetSlot::class, 'proposed_slot_id');
    }

    public function getStatus(): MeetAndGreetStatus
    {
        return $this->status instanceof MeetAndGreetStatus
            ? $this->status
            : (MeetAndGreetStatus::tryFrom((string) $this->status) ?: MeetAndGreetStatus::Booked);
    }

    public function getEndReason(): ?MeetAndGreetEndReason
    {
        return $this->end_reason !== null ? MeetAndGreetEndReason::tryFrom((string) $this->end_reason) : null;
    }

    public function isActive(): bool
    {
        return $this->getStatus() === MeetAndGreetStatus::Booked
            || $this->getStatus() === MeetAndGreetStatus::Confirmed;
    }

    public function scopeActive($query)
    {
        return $query->whereIn('status', [
            MeetAndGreetStatus::Booked->value,
            MeetAndGreetStatus::Confirmed->value,
        ]);
    }
}
