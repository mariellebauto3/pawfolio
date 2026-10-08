<?php

declare(strict_types=1);

namespace App\Http\Resources\AdoptionRequests;

use App\Enums\AdoptionRequestStatus;
use App\Enums\MeetAndGreetStatus;
use App\Http\Resources\Profiles\HomeProfileResource;
use App\Http\Resources\Profiles\PetResource;
use App\Models\AdoptionRequest;
use App\Models\HomeProfile;
use App\Models\MatchScore;
use App\Models\MeetAndGreet;
use App\Models\MeetGreetSlot;
use App\Models\RequestMessage;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * AdoptionRequest resource matching frontend/src/types/adoption-request.ts (BE-16..BE-18, SEC-PRIV-02/04).
 */
class AdoptionRequestResource extends JsonResource
{
    private bool $includeDetails = false;

    private bool $includePrivateMessages = false;

    public function withDetails(bool $include = true): self
    {
        $this->includeDetails = $include;

        return $this;
    }

    public function withPrivateMessages(bool $include = true): self
    {
        $this->includePrivateMessages = $include;

        return $this;
    }

    public function toArray(Request $request): array
    {
        /** @var AdoptionRequest $ar */
        $ar = $this->resource;
        $ar->loadMissing(['pet.photos', 'homeProfile.householdMembers']);

        $status = $ar->getStatus()->value;

        $data = [
            'id' => $ar->id,
            'status' => $status,
            'pet' => $ar->pet ? PetResource::summary($ar->pet) : null,
            'home_profile' => $ar->homeProfile ? self::home($ar->homeProfile) : null,
            'cover_letter' => $ar->cover_letter,
            'caretaker_notes' => $ar->caretaker_notes,
            'approval_message' => $ar->approval_message,
            'decline_reason' => $ar->decline_reason,
            'decision_message' => $ar->decision_message,
            'withdraw_reason' => $ar->withdraw_reason,
            'sent_at' => $ar->sent_at?->toISOString(),
            'expires_at' => $ar->expires_at?->toISOString(),
            'approved_at' => $ar->approved_at?->toISOString(),
            'meet_scheduled_at' => $ar->meet_scheduled_at?->toISOString(),
            'awaiting_decision_at' => $ar->awaiting_decision_at?->toISOString(),
            'overdue_flagged_at' => $ar->overdue_flagged_at?->toISOString(),
            'closed_at' => $ar->closed_at?->toISOString(),
        ];

        if (! $this->includeDetails) {
            return $data;
        }

        $ar->loadMissing([
            'activeMeetAndGreet.slot',
            'latestMeetAndGreet.slot',
            'latestMeetAndGreet.proposedSlot',
            'homeProfile.meetAndGreetSlots',
            'adoption',
        ]);

        $matchScore = MatchScore::query()
            ->where('pet_id', $ar->pet_id)
            ->where('home_profile_id', $ar->home_profile_id)
            ->value('score');

        $cooldownUntil = null;
        if (in_array($status, [AdoptionRequestStatus::Declined->value, AdoptionRequestStatus::NotAdopted->value], true) && $ar->closed_at) {
            $cooldownEnd = $ar->closed_at->copy()->addDays(30);
            if ($cooldownEnd->isFuture()) {
                $cooldownUntil = $cooldownEnd->toISOString();
            }
        }

        $viewer = $request->user();
        $isParticipantOrAdmin = $viewer && (
            $viewer->isAdmin()
            || ($viewer->pet && $viewer->pet->id === $ar->pet_id)
            || ($viewer->homeProfile && $viewer->homeProfile->id === $ar->home_profile_id)
        );

        $activeMeet = $ar->activeMeetAndGreet;
        $latestMeet = $ar->latestMeetAndGreet;
        $isMeetConfirmed = ($activeMeet && $activeMeet->getStatus() === MeetAndGreetStatus::Confirmed)
            || ($latestMeet && $latestMeet->getStatus() === MeetAndGreetStatus::Confirmed)
            || in_array($status, [
                AdoptionRequestStatus::AwaitingDecision->value,
                AdoptionRequestStatus::Adopted->value,
            ], true);

        $formattedActiveMeet = $activeMeet ? self::formatMeetAndGreet($activeMeet) : null;
        $formattedLatestMeet = $latestMeet ? self::formatMeetAndGreet($latestMeet) : null;

        $data['match_score'] = $matchScore !== null ? (int) $matchScore : null;
        $data['cooldown_until'] = $cooldownUntil;
        $data['is_thread_open'] = in_array($status, AdoptionRequest::IN_PROCESS_STATUSES, true);
        $data['meet_and_greet'] = $formattedActiveMeet ?? $formattedLatestMeet;
        $data['active_meet_and_greet'] = $formattedActiveMeet;
        $data['latest_meet_and_greet'] = $formattedLatestMeet;

        // Contact details unlocked ONLY after a Meet & Greet is confirmed (SEC-PRIV-02, MG-07).
        if ($isMeetConfirmed && $isParticipantOrAdmin) {
            $contactPayload = [
                'caretaker_name' => $ar->pet?->caretaker_name,
                'caretaker_contact_number' => $ar->pet?->caretaker_contact_number,
                'human_full_name' => $ar->homeProfile?->full_name,
                'human_contact_number' => $ar->homeProfile?->contact_number,
                'human_street_address' => $ar->homeProfile?->street_address,
                'human_city' => $ar->homeProfile?->city,
                'human_province' => $ar->homeProfile?->province,
            ];
            $data['contact_unlocked'] = true;
            $data['contacts'] = $contactPayload;
            $data['unlocked_contact'] = $contactPayload;
        } else {
            $data['contact_unlocked'] = false;
            $data['contacts'] = null;
            $data['unlocked_contact'] = null;
        }

        if (in_array($status, [AdoptionRequestStatus::Approved->value, AdoptionRequestStatus::MeetScheduled->value], true) && $ar->homeProfile) {
            $data['available_slots'] = $ar->homeProfile->meetAndGreetSlots()
                ->available()
                ->where('starts_at', '>', now())
                ->whereDoesntHave('bookings', fn ($q) => $q->whereIn('status', ['booked', 'confirmed']))
                ->orderBy('starts_at')
                ->get()
                ->map(fn (MeetGreetSlot $slot) => self::formatSlot($slot))
                ->values()
                ->all();
        } else {
            $data['available_slots'] = [];
        }

        $data['messages_count'] = (int) ($ar->messages_count ?? $ar->messages()->count());

        if ($this->includePrivateMessages) {
            $ar->loadMissing('messages.sender');
            $data['messages'] = $ar->messages
                ->sortBy('created_at')
                ->map(fn (RequestMessage $msg) => [
                    'id' => $msg->id,
                    'sender_user_id' => $msg->sender_user_id,
                    'sender_name' => $msg->sender?->displayName(),
                    'sender_role' => $msg->sender?->getRole()->value,
                    'body' => $msg->body,
                    'created_at' => $msg->created_at?->toISOString(),
                ])
                ->values()
                ->all();
        }

        return $data;
    }

    /**
     * The home as a request names it: the summary, and the two public facts a row of My requests shows beside the
     * city (RQ-07). Never the address or the phone number (SEC-PRIV-03); those are `contacts`, above.
     *
     * @return array<string, mixed>
     */
    private static function home(HomeProfile $home): array
    {
        $value = fn ($answer) => $answer instanceof \BackedEnum ? $answer->value : $answer;

        return [
            ...HomeProfileResource::summary($home),
            'home_type' => $value($home->home_type),
            'household_members' => $home->householdMembers->map(fn ($row) => $value($row->member))->values()->all(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public static function formatSlot(MeetGreetSlot $slot): array
    {
        return [
            'id' => $slot->id,
            'home_profile_id' => $slot->home_profile_id,
            'starts_at' => $slot->starts_at?->toISOString(),
            'place_type' => $slot->placeType()->value,
            'place_details' => $slot->place_details,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public static function formatMeetAndGreet(MeetAndGreet $mg): array
    {
        $mg->loadMissing(['slot', 'proposedSlot']);

        return [
            'id' => $mg->id,
            'adoption_request_id' => $mg->adoption_request_id,
            'meet_greet_slot_id' => $mg->meet_greet_slot_id,
            'status' => $mg->getStatus()->value,
            'booked_at' => $mg->booked_at?->toISOString(),
            'confirmed_at' => $mg->confirmed_at?->toISOString(),
            'ended_at' => $mg->ended_at?->toISOString(),
            'ended_by_user_id' => $mg->ended_by_user_id,
            'end_reason' => $mg->end_reason,
            'end_details' => $mg->end_details,
            'proposed_slot_id' => $mg->proposed_slot_id,
            'slot' => $mg->slot ? self::formatSlot($mg->slot) : null,
            'proposed_slot' => $mg->proposedSlot ? self::formatSlot($mg->proposedSlot) : null,
        ];
    }
}
