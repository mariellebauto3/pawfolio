<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\MeetAndGreet;

use App\Enums\ActivityLogType;
use App\Enums\AdoptionRequestStatus;
use App\Enums\MeetAndGreetEndReason;
use App\Enums\MeetAndGreetStatus;
use App\Enums\MeetGreetPlaceType;
use App\Enums\NotificationType;
use App\Http\Controllers\Controller;
use App\Http\Resources\AdoptionRequests\AdoptionRequestResource;
use App\Http\Resources\ErrorResource;
use App\Http\Resources\ResponseResource;
use App\Models\AdoptionRequest;
use App\Models\MeetAndGreet;
use App\Models\MeetGreetSlot;
use App\Models\User;
use App\Services\ActivityLogs\ActivityLogger;
use App\Services\Notifications\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Meet & Greet booking, confirmation, proposing another time, rescheduling, cancelling, and reporting missed meetings (BE-17, MG-03..MG-13).
 */
class MeetAndGreetController extends Controller
{
    public const BOOKING_WINDOW_DAYS = 14;

    public function __construct(
        private readonly NotificationService $notifications,
    ) {}

    public function book(Request $request, AdoptionRequest $adoptionRequest)
    {
        $user = $request->user();

        if (! $user->isPet() || ! $user->pet || $adoptionRequest->pet_id !== $user->pet->id) {
            return ErrorResource::forbidden('Only the pet owner on this request can book a Meet & Greet slot.')->toResponse($request);
        }

        $validated = $request->validate([
            'meet_greet_slot_id' => ['required_without:slot_id', 'nullable', 'integer'],
            'slot_id' => ['required_without:meet_greet_slot_id', 'nullable', 'integer'],
        ]);

        $slotId = (int) ($validated['meet_greet_slot_id'] ?? $validated['slot_id']);

        return DB::transaction(function () use ($adoptionRequest, $slotId, $user, $request) {
            /** @var AdoptionRequest $ar */
            $ar = AdoptionRequest::query()
                ->with(['pet', 'homeProfile.user', 'activeMeetAndGreet'])
                ->whereKey($adoptionRequest->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($ar->getStatus() !== AdoptionRequestStatus::Approved) {
                return ErrorResource::conflict(
                    'A Meet & Greet slot can only be booked while the request is Approved.',
                    'invalid_request_state',
                )->toResponse($request);
            }

            /** @var MeetGreetSlot|null $slot */
            $slot = MeetGreetSlot::query()
                ->available()
                ->where('home_profile_id', $ar->home_profile_id)
                ->whereKey($slotId)
                ->lockForUpdate()
                ->first();

            if (! $slot || $slot->starts_at->isPast()) {
                return ErrorResource::notFound('That Meet & Greet slot is no longer available.')->toResponse($request);
            }

            // Ensure no other active booking occupies this slot.
            $existingOnSlot = MeetAndGreet::query()
                ->where('meet_greet_slot_id', $slot->id)
                ->where('adoption_request_id', '!=', $ar->id)
                ->active()
                ->exists();

            if ($existingOnSlot) {
                return ErrorResource::conflict('That slot has already been booked.', 'slot_already_booked')->toResponse($request);
            }

            // If the pet already had an unconfirmed booking on this request, end it before creating the new booking (MG-04).
            if ($ar->activeMeetAndGreet) {
                $prev = $ar->activeMeetAndGreet;
                $prev->status = MeetAndGreetStatus::Ended->value;
                $prev->ended_at = now();
                $prev->ended_by_user_id = $user->id;
                $prev->end_reason = MeetAndGreetEndReason::MovedToAnotherDay->value;
                $prev->proposed_slot_id = $slot->id;
                $prev->save();
            }

            $mg = new MeetAndGreet;
            $mg->adoption_request_id = $ar->id;
            $mg->meet_greet_slot_id = $slot->id;
            $mg->status = MeetAndGreetStatus::Booked->value;
            $mg->booked_at = now();
            $mg->save();

            if ($ar->homeProfile?->user) {
                $this->notifyMeetAndGreet(
                    recipient: $ar->homeProfile->user,
                    type: NotificationType::MeetGreetBooked->value,
                    title: "{$ar->pet->name} booked a Meet & Greet slot",
                    body: "Please confirm the slot for {$slot->starts_at->format('M j, Y g:i A')} or propose another time.",
                    ar: $ar,
                );
            }

            ActivityLogger::log(
                type: ActivityLogType::MeetAndGreet,
                action: 'meet_and_greet_booked',
                actor: $user,
                subject: $mg,
                after: MeetAndGreetStatus::Booked->value,
                userAgent: $request->userAgent(),
            );

            return ResponseResource::created(
                (new AdoptionRequestResource($ar->fresh(['pet.photos', 'homeProfile', 'activeMeetAndGreet.slot'])))
                    ->withDetails()
                    ->toArray($request),
            )->toResponse($request);
        });
    }

    public function confirm(Request $request, AdoptionRequest $adoptionRequest)
    {
        $user = $request->user();

        if (! $user->isHuman() || ! $user->homeProfile || $adoptionRequest->home_profile_id !== $user->homeProfile->id) {
            return ErrorResource::forbidden('Only the Home Profile owner can confirm a Meet & Greet booking.')->toResponse($request);
        }

        return DB::transaction(function () use ($adoptionRequest, $user, $request) {
            /** @var AdoptionRequest $ar */
            $ar = AdoptionRequest::query()
                ->with(['pet.user', 'homeProfile', 'activeMeetAndGreet.slot'])
                ->whereKey($adoptionRequest->id)
                ->lockForUpdate()
                ->firstOrFail();

            $mg = $ar->activeMeetAndGreet;
            if (! $mg || $mg->getStatus() !== MeetAndGreetStatus::Booked) {
                return ErrorResource::conflict(
                    'There is no pending Meet & Greet booking to confirm.',
                    'no_pending_booking',
                )->toResponse($request);
            }

            $now = now();
            $mg->status = MeetAndGreetStatus::Confirmed->value;
            $mg->confirmed_at = $now;
            $mg->save();

            $beforeRequestStatus = $ar->getStatus()->value;
            $ar->status = AdoptionRequestStatus::MeetScheduled->value;
            $ar->meet_scheduled_at = $now;
            $ar->expires_at = null;
            $ar->save();

            if ($ar->pet?->user) {
                $this->notifyMeetAndGreet(
                    recipient: $ar->pet->user,
                    type: NotificationType::MeetGreetBooked->value,
                    title: "{$ar->homeProfile->full_name} confirmed your Meet & Greet!",
                    body: 'Your meeting is confirmed and contact details are now unlocked.',
                    ar: $ar,
                );
            }

            ActivityLogger::log(
                type: ActivityLogType::MeetAndGreet,
                action: 'meet_and_greet_confirmed',
                actor: $user,
                subject: $mg,
                before: MeetAndGreetStatus::Booked->value,
                after: MeetAndGreetStatus::Confirmed->value,
                userAgent: $request->userAgent(),
            );

            ActivityLogger::log(
                type: ActivityLogType::StatusChange,
                action: 'adoption_request_meet_scheduled',
                actor: null,
                subject: $ar,
                before: $beforeRequestStatus,
                after: AdoptionRequestStatus::MeetScheduled->value,
                userAgent: $request->userAgent(),
            );

            return ResponseResource::make(
                (new AdoptionRequestResource($ar->fresh(['pet.photos', 'homeProfile', 'activeMeetAndGreet.slot'])))
                    ->withDetails()
                    ->toArray($request),
            )->toResponse($request);
        });
    }

    public function proposeTime(Request $request, AdoptionRequest $adoptionRequest)
    {
        $user = $request->user();

        if (! $user->isHuman() || ! $user->homeProfile || $adoptionRequest->home_profile_id !== $user->homeProfile->id) {
            return ErrorResource::forbidden('Only the Home Profile owner can propose another time.')->toResponse($request);
        }

        $validated = $request->validate([
            'proposed_slot_id' => ['nullable', 'integer'],
            'starts_at' => ['required_without:proposed_slot_id', 'nullable', 'date', 'after:now'],
            'place_type' => ['required_with:starts_at', 'nullable', 'string', Rule::in(array_map(fn ($c) => $c->value, MeetGreetPlaceType::cases()))],
            'place_details' => ['required_with:starts_at', 'nullable', 'string', 'max:255'],
            'message' => ['nullable', 'string', 'max:600'],
        ]);

        return DB::transaction(function () use ($adoptionRequest, $user, $validated, $request) {
            /** @var AdoptionRequest $ar */
            $ar = AdoptionRequest::query()
                ->with(['pet.user', 'homeProfile', 'activeMeetAndGreet'])
                ->whereKey($adoptionRequest->id)
                ->lockForUpdate()
                ->firstOrFail();

            $mg = $ar->activeMeetAndGreet;
            if (! $mg) {
                return ErrorResource::conflict('There is no active Meet & Greet booking to reschedule.', 'no_active_booking')->toResponse($request);
            }

            $proposedSlot = null;
            if (! empty($validated['proposed_slot_id'])) {
                $proposedSlot = MeetGreetSlot::query()
                    ->available()
                    ->where('home_profile_id', $ar->home_profile_id)
                    ->find((int) $validated['proposed_slot_id']);
                if (! $proposedSlot) {
                    return ErrorResource::notFound('Proposed slot not found.')->toResponse($request);
                }
            } else {
                $proposedSlot = new MeetGreetSlot;
                $proposedSlot->home_profile_id = $ar->home_profile_id;
                $proposedSlot->starts_at = Carbon::parse($validated['starts_at']);
                $proposedSlot->place_type = $validated['place_type'];
                $proposedSlot->place_details = trim($validated['place_details']);
                $proposedSlot->save();
            }

            $mg->status = MeetAndGreetStatus::Ended->value;
            $mg->ended_at = now();
            $mg->ended_by_user_id = $user->id;
            $mg->end_reason = MeetAndGreetEndReason::MovedToAnotherDay->value;
            $mg->end_details = isset($validated['message']) && trim($validated['message']) !== '' ? trim($validated['message']) : null;
            $mg->proposed_slot_id = $proposedSlot->id;
            $mg->save();

            // Request returns to Approved so the pet can rebook (MG-06).
            $ar->status = AdoptionRequestStatus::Approved->value;
            $ar->meet_scheduled_at = null;
            $ar->expires_at = now()->addDays(self::BOOKING_WINDOW_DAYS);
            $ar->save();

            if ($ar->pet?->user) {
                $this->notifyMeetAndGreet(
                    recipient: $ar->pet->user,
                    type: NotificationType::MeetGreetBooked->value,
                    title: "{$ar->homeProfile->full_name} proposed another Meet & Greet time",
                    body: 'Please review the available slots and book a time that works for you.',
                    ar: $ar,
                );
            }

            ActivityLogger::log(
                type: ActivityLogType::MeetAndGreet,
                action: 'meet_and_greet_time_proposed',
                actor: $user,
                subject: $mg,
                userAgent: $request->userAgent(),
            );

            return ResponseResource::make(
                (new AdoptionRequestResource($ar->fresh(['pet.photos', 'homeProfile', 'activeMeetAndGreet.slot', 'latestMeetAndGreet.slot'])))
                    ->withDetails()
                    ->toArray($request),
            )->toResponse($request);
        });
    }

    public function reschedule(Request $request, AdoptionRequest $adoptionRequest)
    {
        $user = $request->user();

        if ($user->isHuman() && $user->homeProfile && $adoptionRequest->home_profile_id === $user->homeProfile->id) {
            return $this->proposeTime($request, $adoptionRequest);
        }

        if (! $user->isPet() || ! $user->pet || $adoptionRequest->pet_id !== $user->pet->id) {
            return ErrorResource::forbidden('You do not have permission to reschedule this meeting.')->toResponse($request);
        }

        $validated = $request->validate([
            'meet_greet_slot_id' => ['required_without:slot_id', 'nullable', 'integer'],
            'slot_id' => ['required_without:meet_greet_slot_id', 'nullable', 'integer'],
            'reason' => ['nullable', 'string', 'max:600'],
        ]);

        $slotId = (int) ($validated['meet_greet_slot_id'] ?? $validated['slot_id']);

        return DB::transaction(function () use ($adoptionRequest, $slotId, $validated, $user, $request) {
            /** @var AdoptionRequest $ar */
            $ar = AdoptionRequest::query()
                ->with(['pet', 'homeProfile.user', 'activeMeetAndGreet'])
                ->whereKey($adoptionRequest->id)
                ->lockForUpdate()
                ->firstOrFail();

            $currentMg = $ar->activeMeetAndGreet;
            if (! $currentMg) {
                return ErrorResource::conflict('There is no active Meet & Greet booking to reschedule.', 'no_active_booking')->toResponse($request);
            }

            /** @var MeetGreetSlot|null $newSlot */
            $newSlot = MeetGreetSlot::query()
                ->available()
                ->where('home_profile_id', $ar->home_profile_id)
                ->whereKey($slotId)
                ->lockForUpdate()
                ->first();

            if (! $newSlot || $newSlot->starts_at->isPast()) {
                return ErrorResource::notFound('Selected Meet & Greet slot is not available.')->toResponse($request);
            }

            $currentMg->status = MeetAndGreetStatus::Ended->value;
            $currentMg->ended_at = now();
            $currentMg->ended_by_user_id = $user->id;
            $currentMg->end_reason = MeetAndGreetEndReason::MovedToAnotherDay->value;
            $currentMg->end_details = isset($validated['reason']) && trim($validated['reason']) !== '' ? trim($validated['reason']) : null;
            $currentMg->proposed_slot_id = $newSlot->id;
            $currentMg->save();

            $newMg = new MeetAndGreet;
            $newMg->adoption_request_id = $ar->id;
            $newMg->meet_greet_slot_id = $newSlot->id;
            $newMg->status = MeetAndGreetStatus::Booked->value;
            $newMg->booked_at = now();
            $newMg->save();

            // Human must confirm the newly booked slot again (MG-09 -> MG-05).
            $ar->status = AdoptionRequestStatus::Approved->value;
            $ar->meet_scheduled_at = null;
            $ar->expires_at = now()->addDays(self::BOOKING_WINDOW_DAYS);
            $ar->save();

            if ($ar->homeProfile?->user) {
                $this->notifyMeetAndGreet(
                    recipient: $ar->homeProfile->user,
                    type: NotificationType::MeetGreetBooked->value,
                    title: "{$ar->pet->name} requested to reschedule the Meet & Greet",
                    body: "Please confirm the new slot on {$newSlot->starts_at->format('M j, Y g:i A')}.",
                    ar: $ar,
                );
            }

            ActivityLogger::log(
                type: ActivityLogType::MeetAndGreet,
                action: 'meet_and_greet_rescheduled',
                actor: $user,
                subject: $newMg,
                reason: $currentMg->end_details,
                userAgent: $request->userAgent(),
            );

            return ResponseResource::make(
                (new AdoptionRequestResource($ar->fresh(['pet.photos', 'homeProfile', 'activeMeetAndGreet.slot'])))
                    ->withDetails()
                    ->toArray($request),
            )->toResponse($request);
        });
    }

    public function cancel(Request $request, AdoptionRequest $adoptionRequest)
    {
        $user = $request->user();
        $isPetParty = $user->isPet() && $user->pet && $adoptionRequest->pet_id === $user->pet->id;
        $isHumanParty = $user->isHuman() && $user->homeProfile && $adoptionRequest->home_profile_id === $user->homeProfile->id;

        if (! $isPetParty && ! $isHumanParty) {
            return ErrorResource::forbidden('You do not have permission to cancel this Meet & Greet.')->toResponse($request);
        }

        $validated = $request->validate([
            'reason' => ['required', 'string', Rule::in([
                MeetAndGreetEndReason::ScheduleConflict->value,
                MeetAndGreetEndReason::PetUnwell->value,
                MeetAndGreetEndReason::WeatherOrTravel->value,
                MeetAndGreetEndReason::Other->value,
            ])],
            'details' => ['nullable', 'string', 'max:600'],
        ], [
            'reason.required' => 'Choose a reason for cancelling the meeting.',
        ]);

        return DB::transaction(function () use ($adoptionRequest, $user, $isPetParty, $validated, $request) {
            /** @var AdoptionRequest $ar */
            $ar = AdoptionRequest::query()
                ->with(['pet.user', 'homeProfile.user', 'activeMeetAndGreet'])
                ->whereKey($adoptionRequest->id)
                ->lockForUpdate()
                ->firstOrFail();

            $mg = $ar->activeMeetAndGreet;
            if (! $mg) {
                return ErrorResource::conflict('There is no active Meet & Greet booking to cancel.', 'no_active_booking')->toResponse($request);
            }

            $mg->status = MeetAndGreetStatus::Ended->value;
            $mg->ended_at = now();
            $mg->ended_by_user_id = $user->id;
            $mg->end_reason = $validated['reason'];
            $mg->end_details = isset($validated['details']) && trim($validated['details']) !== '' ? trim($validated['details']) : null;
            $mg->save();

            // Request goes back to Approved and booking reopens (MG-10).
            $ar->status = AdoptionRequestStatus::Approved->value;
            $ar->meet_scheduled_at = null;
            $ar->expires_at = now()->addDays(self::BOOKING_WINDOW_DAYS);
            $ar->save();

            $otherUser = $isPetParty ? $ar->homeProfile?->user : $ar->pet?->user;
            if ($otherUser) {
                $this->notifyMeetAndGreet(
                    recipient: $otherUser,
                    type: NotificationType::MeetGreetCancelled->value,
                    title: 'Meet & Greet cancelled',
                    body: 'The scheduled Meet & Greet was cancelled. Slot booking has reopened for this request.',
                    ar: $ar,
                );
            }

            ActivityLogger::log(
                type: ActivityLogType::MeetAndGreet,
                action: 'meet_and_greet_cancelled',
                actor: $user,
                subject: $mg,
                reason: $mg->end_reason,
                userAgent: $request->userAgent(),
            );

            return ResponseResource::make(
                (new AdoptionRequestResource($ar->fresh(['pet.photos', 'homeProfile', 'activeMeetAndGreet.slot', 'latestMeetAndGreet.slot'])))
                    ->withDetails()
                    ->toArray($request),
            )->toResponse($request);
        });
    }

    public function didntHappen(Request $request, AdoptionRequest $adoptionRequest)
    {
        $user = $request->user();

        if (! $user->isHuman() || ! $user->homeProfile || $adoptionRequest->home_profile_id !== $user->homeProfile->id) {
            return ErrorResource::forbidden('Only the Home Profile owner can report that the meeting did not happen.')->toResponse($request);
        }

        $validated = $request->validate([
            'reason' => ['required', 'string', Rule::in([
                MeetAndGreetEndReason::DidntShowPetSide->value,
                MeetAndGreetEndReason::DidntShowHumanSide->value,
                MeetAndGreetEndReason::MovedToAnotherDay->value,
                MeetAndGreetEndReason::Other->value,
            ])],
            'details' => ['nullable', 'string', 'max:600'],
        ]);

        return DB::transaction(function () use ($adoptionRequest, $user, $validated, $request) {
            /** @var AdoptionRequest $ar */
            $ar = AdoptionRequest::query()
                ->with(['pet.user', 'homeProfile', 'activeMeetAndGreet', 'latestMeetAndGreet'])
                ->whereKey($adoptionRequest->id)
                ->lockForUpdate()
                ->firstOrFail();

            if (! in_array($ar->getStatus(), [
                AdoptionRequestStatus::MeetScheduled,
                AdoptionRequestStatus::AwaitingDecision,
            ], true)) {
                return ErrorResource::conflict('This action is only available for scheduled or post-meeting requests.', 'invalid_request_state')->toResponse($request);
            }

            $mg = $ar->activeMeetAndGreet ?? $ar->latestMeetAndGreet;
            if ($mg) {
                $mg->status = MeetAndGreetStatus::Ended->value;
                $mg->ended_at = now();
                $mg->ended_by_user_id = $user->id;
                $mg->end_reason = $validated['reason'];
                $mg->end_details = isset($validated['details']) && trim($validated['details']) !== '' ? trim($validated['details']) : null;
                $mg->save();
            }

            $ar->status = AdoptionRequestStatus::Approved->value;
            $ar->meet_scheduled_at = null;
            $ar->awaiting_decision_at = null;
            $ar->overdue_flagged_at = null;
            $ar->expires_at = now()->addDays(self::BOOKING_WINDOW_DAYS);
            $ar->save();

            if ($ar->pet?->user) {
                $this->notifyMeetAndGreet(
                    recipient: $ar->pet->user,
                    type: NotificationType::MeetGreetCancelled->value,
                    title: 'Meet & Greet booking reopened',
                    body: "{$ar->homeProfile->full_name} reported that the meeting didn't happen and reopened booking.",
                    ar: $ar,
                );
            }

            ActivityLogger::log(
                type: ActivityLogType::MeetAndGreet,
                action: 'meet_and_greet_didnt_happen',
                actor: $user,
                subject: $mg ?? $ar,
                reason: $validated['reason'],
                userAgent: $request->userAgent(),
            );

            return ResponseResource::make(
                (new AdoptionRequestResource($ar->fresh(['pet.photos', 'homeProfile', 'activeMeetAndGreet.slot', 'latestMeetAndGreet.slot'])))
                    ->withDetails()
                    ->toArray($request),
            )->toResponse($request);
        });
    }

    private function notifyMeetAndGreet(User $recipient, string $type, string $title, string $body, AdoptionRequest $ar): void
    {
        $prefs = $recipient->notificationPreference;
        if ($prefs && ! $prefs->shouldMeetAndGreet()) {
            return;
        }

        $this->notifications->store(
            recipient: $recipient,
            type: $type,
            title: $title,
            body: $body,
            data: [
                'category' => 'Meet & Greets',
                'adoption_request_id' => $ar->id,
                'pet_id' => $ar->pet_id,
                'home_profile_id' => $ar->home_profile_id,
                'link' => "/requests/{$ar->id}",
            ],
            urgency: 'info',
            actionUrl: "/requests/{$ar->id}",
        );
    }
}
