<?php

namespace App\Models;

use App\Enums\MeetAndGreetEndReason;
use App\Enums\MeetAndGreetStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MeetAndGreet extends Model
{
    protected $table = 'meet_and_greets';

    protected $fillable = [
        'adoption_request_id',
        'meet_greet_slot_id',
        'status',
        'booked_at',
        'confirmed_at',
        'ended_at',
        'ended_by_user_id',
        'end_reason',
        'end_details',
        'proposed_slot_id',
    ];

    protected $casts = [
        'id' => 'integer',
        'adoption_request_id' => 'integer',
        'meet_greet_slot_id' => 'integer',
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
        return MeetAndGreetStatus::tryFrom($this->status) ?: MeetAndGreetStatus::Booked;
    }

    public function getEndReason(): ?MeetAndGreetEndReason
    {
        return MeetAndGreetEndReason::tryFrom($this->end_reason);
    }

    public function isActive(): bool
    {
        return $this->getStatus() === MeetAndGreetStatus::Booked
            || $this->getStatus() === MeetAndGreetStatus::Confirmed;
    }
}
