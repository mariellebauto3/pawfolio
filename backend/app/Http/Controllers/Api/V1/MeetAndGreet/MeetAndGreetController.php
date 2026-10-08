<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\MeetAndGreet;

use App\Enums\ActivityLogType;
use App\Enums\AdoptionRequestStatus;
use App\Enums\MeetAndGreetEndReason;
use App\Enums\MeetAndGreetStatus;
use App\Enums\NotificationType;
use App\Http\Controllers\Controller;
use App\Http\Requests\MeetAndGreet\CancelMeetAndGreetRequest;
use App\Http\Requests\MeetAndGreet\ChooseMeetGreetSlotRequest;
use App\Http\Requests\MeetAndGreet\ProposeMeetingTimeRequest;
use App\Http\Resources\AdoptionRequests\AdoptionRequestResource;
use App\Http\Resources\ErrorResource;
use App\Http\Resources\ResponseResource;
use App\Models\AdoptionRequest;
use App\Models\MeetAndGreet;
use App\Models\MeetGreetSlot;
use App\Models\User;
use App\Services\ActivityLogs\ActivityLogger;
use App\Services\Notifications\NotificationService;
use App\Support\PhilippineTime;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * The Meet & Greet of an approved request (BE-17, MG-03…MG-10, FR11, FR26, docs/api/adoption-and-meet-greet.md): the
 * pet books a slot, the human confirms or proposes another time, either side reschedules or cancels. Only the two
 * sides of a request act on it; anyone else is answered 404 (SEC-AUTHZ-04). Reporting a meeting that didn't happen
 * (MG-13) is here too.
 */
class MeetAndGreetController extends Controller
{
    public const BOOKING_WINDOW_DAYS = 14;

    public function __construct(
        private readonly NotificationService $notifications,
    ) {}

    /** MG-03: the pet books one of the home's open slots. Booking again before the human confirms changes the slot (MG-04). */
    public function book(ChooseMeetGreetSlotRequest $request, int $adoptionRequest)
    {
        $user = $request->user();
        $found = $this->requestFor($user, $adoptionRequest, 'bookMeeting');
        if ($found === null) {
            return $this->notFound($request);
        }

        return DB::transaction(function () use ($found, $user, $request) {
            $ar = $this->locked($found, ['pet', 'homeProfile.user', 'activeMeetAndGreet']);

            if ($ar->getStatus() !== AdoptionRequestStatus::Approved) {
                return ErrorResource::conflict(
                    'A Meet & Greet can be booked while the request is Approved.',
                    'invalid_request_state',
                )->toResponse($request);
            }

            $slot = $this->lockedSlot($ar, $request->slotId());
            if ($problem = $this->slotProblem($ar, $slot)) {
                return $problem->toResponse($request);
            }

            // A booking the human hasn't confirmed yet gives way to the new one (MG-04).
            if ($ar->activeMeetAndGreet) {
                $this->end($ar->activeMeetAndGreet, $user, MeetAndGreetEndReason::MovedToAnotherDay, movedTo: $slot);
            }

            $mg = $this->newBooking($ar, $slot);

            if ($ar->homeProfile?->user) {
                $this->notifyMeetAndGreet(
                    recipient: $ar->homeProfile->user,
                    type: NotificationType::MeetGreetBooked->value,
                    title: "{$ar->pet->name} booked a Meet & Greet slot",
                    body: 'Confirm '.PhilippineTime::format($slot->starts_at).', or propose another time.',
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

            return $this->answer($ar, $request, 201);
        });
    }

    /** MG-05: the human confirms the booking. The request becomes Meet Scheduled and each side's contact details open to the other (MG-07, MG-08, SEC-PRIV-02). */
    public function confirm(Request $request, int $adoptionRequest)
    {
        $user = $request->user();
        $found = $this->requestFor($user, $adoptionRequest, 'answerBooking');
        if ($found === null) {
            return $this->notFound($request);
        }

        return DB::transaction(function () use ($found, $user, $request) {
            $ar = $this->locked($found, ['pet.user', 'homeProfile', 'activeMeetAndGreet.slot']);

            $mg = $ar->activeMeetAndGreet;
            if (! $mg || $mg->getStatus() !== MeetAndGreetStatus::Booked) {
                return ErrorResource::conflict(
                    'There is no booking waiting for you to confirm.',
                    'no_pending_booking',
                )->toResponse($request);
            }

            // A meeting can't be scheduled for a time that is already behind us.
            if (! $mg->slot || ! $mg->slot->starts_at->isFuture()) {
                return ErrorResource::conflict(
                    'That time has already passed. Propose another time instead.',
                    'slot_passed',
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
                    body: 'You meet on '.PhilippineTime::format($mg->slot->starts_at).'. Contact details are now shared on the request.',
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

            return $this->answer($ar, $request);
        });
    }

    /**
     * MG-06: the human offers another of their open slots in place of the booking. The booking ends and booking
     * reopens: the pet picks the offered slot, or any other, to book again.
     */
    public function proposeTime(ProposeMeetingTimeRequest $request, int $adoptionRequest)
    {
        $user = $request->user();
        $found = $this->requestFor($user, $adoptionRequest, 'answerBooking');
        if ($found === null) {
            return $this->notFound($request);
        }

        return DB::transaction(function () use ($found, $user, $request) {
            $ar = $this->locked($found, ['pet.user', 'homeProfile', 'activeMeetAndGreet']);

            $mg = $ar->activeMeetAndGreet;
            if (! $mg) {
                return ErrorResource::conflict('There is no booking to move to another time.', 'no_active_booking')->toResponse($request);
            }

            // Only a slot the pet can really book is worth offering: still ahead, and held by nobody.
            $slot = $this->lockedSlot($ar, $request->slotId());
            if ($problem = $this->slotProblem($ar, $slot)) {
                return $problem->toResponse($request);
            }

            $this->end($mg, $user, MeetAndGreetEndReason::MovedToAnotherDay, $request->message(), $slot);
            $this->reopenBooking($ar, 'The human proposed another Meet & Greet time', $request);

            if ($ar->pet?->user) {
                $this->notifyMeetAndGreet(
                    recipient: $ar->pet->user,
                    type: NotificationType::MeetGreetBooked->value,
                    title: "{$ar->homeProfile->full_name} proposed another Meet & Greet time",
                    body: 'They offered '.PhilippineTime::format($slot->starts_at).'. Book it, or pick another open slot.',
                    ar: $ar,
                );
            }

            ActivityLogger::log(
                type: ActivityLogType::MeetAndGreet,
                action: 'meet_and_greet_time_proposed',
                actor: $user,
                subject: $mg,
                reason: $mg->end_details,
                userAgent: $request->userAgent(),
            );

            return $this->answer($ar, $request);
        });
    }

    /**
     * MG-04, MG-09: the pet moves its booking to another open slot, with an optional reason. The human confirms the
     * new time, so a meeting that was confirmed is Approved again and the contact details close until then. A human
     * who reschedules proposes another time instead (MG-06).
     */
    public function reschedule(Request $request, int $adoptionRequest)
    {
        $user = $request->user();
        $found = $this->requestFor($user, $adoptionRequest, 'changeMeeting');
        if ($found === null) {
            return $this->notFound($request);
        }

        if ($user->isHuman()) {
            return $this->proposeTime(app(ProposeMeetingTimeRequest::class), $adoptionRequest);
        }

        /** @var ChooseMeetGreetSlotRequest $chosen */
        $chosen = app(ChooseMeetGreetSlotRequest::class);

        return DB::transaction(function () use ($found, $chosen, $user, $request) {
            $ar = $this->locked($found, ['pet', 'homeProfile.user', 'activeMeetAndGreet']);

            $current = $ar->activeMeetAndGreet;
            if (! $current) {
                return ErrorResource::conflict('There is no booking to reschedule.', 'no_active_booking')->toResponse($request);
            }

            $slot = $this->lockedSlot($ar, $chosen->slotId());
            if ($problem = $this->slotProblem($ar, $slot)) {
                return $problem->toResponse($request);
            }

            $this->end($current, $user, MeetAndGreetEndReason::MovedToAnotherDay, $chosen->reason(), $slot);
            $mg = $this->newBooking($ar, $slot);
            $this->reopenBooking($ar, 'The pet rescheduled the Meet & Greet', $request);

            if ($ar->homeProfile?->user) {
                $this->notifyMeetAndGreet(
                    recipient: $ar->homeProfile->user,
                    type: NotificationType::MeetGreetBooked->value,
                    title: "{$ar->pet->name} asked to move the Meet & Greet",
                    body: 'Confirm the new time, '.PhilippineTime::format($slot->starts_at).', or propose another.',
                    ar: $ar,
                );
            }

            ActivityLogger::log(
                type: ActivityLogType::MeetAndGreet,
                action: 'meet_and_greet_rescheduled',
                actor: $user,
                subject: $mg,
                reason: $current->end_details,
                userAgent: $request->userAgent(),
            );

            return $this->answer($ar, $request);
        });
    }

    /** MG-10: either side calls the Meet & Greet off, with a reason. Booking reopens and the contact details close. */
    public function cancel(CancelMeetAndGreetRequest $request, int $adoptionRequest)
    {
        $user = $request->user();
        $found = $this->requestFor($user, $adoptionRequest, 'changeMeeting');
        if ($found === null) {
            return $this->notFound($request);
        }

        return DB::transaction(function () use ($found, $user, $request) {
            $ar = $this->locked($found, ['pet.user', 'homeProfile.user', 'activeMeetAndGreet']);

            $mg = $ar->activeMeetAndGreet;
            if (! $mg) {
                return ErrorResource::conflict('There is no Meet & Greet to cancel.', 'no_active_booking')->toResponse($request);
            }

            $reason = $request->reason();
            $this->end($mg, $user, $reason, $request->details());
            $this->reopenBooking($ar, 'The Meet & Greet was cancelled', $request);

            $byPet = $user->isPet();
            $other = $byPet ? $ar->homeProfile?->user : $ar->pet?->user;
            if ($other) {
                $who = $byPet ? $ar->pet->name : $ar->homeProfile->full_name;
                $this->notifyMeetAndGreet(
                    recipient: $other,
                    type: NotificationType::MeetGreetCancelled->value,
                    title: "{$who} cancelled the Meet & Greet",
                    body: "Reason: {$reason->label()}. Booking is open again for this request.",
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

            return $this->answer($ar, $request);
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

    /**
     * The request, when the caller may do this with it. Anyone else is answered like a request that doesn't exist,
     * so ids can't be probed (AdoptionRequestPolicy, SEC-AUTHZ-04).
     */
    private function requestFor(User $user, int $id, string $ability): ?AdoptionRequest
    {
        $found = AdoptionRequest::query()->find($id);

        return $found !== null && $user->can($ability, $found) ? $found : null;
    }

    private function notFound(Request $request)
    {
        return ErrorResource::notFound("We couldn't find that request.")->toResponse($request);
    }

    /** The request read again inside the transaction, its row locked, so two changes at once can't both pass (SEC-AUTHZ-08). */
    private function locked(AdoptionRequest $found, array $with): AdoptionRequest
    {
        return AdoptionRequest::query()->with($with)->whereKey($found->id)->lockForUpdate()->firstOrFail();
    }

    /** One of the home's own slots, its row locked while it is being booked. */
    private function lockedSlot(AdoptionRequest $ar, int $slotId): ?MeetGreetSlot
    {
        return MeetGreetSlot::query()
            ->available()
            ->where('home_profile_id', $ar->home_profile_id)
            ->whereKey($slotId)
            ->lockForUpdate()
            ->first();
    }

    /**
     * Why this slot can't be taken for the request, or null when it can: it must be one of the home's own, still
     * ahead, and held by no booking. Another home's slot answers like one that was removed.
     */
    private function slotProblem(AdoptionRequest $ar, ?MeetGreetSlot $slot): ?ErrorResource
    {
        if (! $slot || ! $slot->starts_at->isFuture()) {
            return ErrorResource::conflict("That slot isn't available any more. Choose another one.", 'slot_unavailable');
        }

        $held = MeetAndGreet::query()->where('meet_greet_slot_id', $slot->id)->active()->first();
        if ($held && $held->adoption_request_id === $ar->id) {
            return ErrorResource::conflict('That is the time already booked. Choose another one.', 'slot_unchanged');
        }
        if ($held) {
            return ErrorResource::conflict('That slot was just booked. Choose another one.', 'slot_already_booked');
        }

        return null;
    }

    private function newBooking(AdoptionRequest $ar, MeetGreetSlot $slot): MeetAndGreet
    {
        $mg = new MeetAndGreet;
        $mg->adoption_request_id = $ar->id;
        $mg->meet_greet_slot_id = $slot->id;
        $mg->status = MeetAndGreetStatus::Booked->value;
        $mg->booked_at = now();
        $mg->save();

        return $mg;
    }

    /** Ends a booking: who ended it, why, and the slot it moved to or the human offered instead. */
    private function end(MeetAndGreet $mg, User $by, MeetAndGreetEndReason $reason, ?string $details = null, ?MeetGreetSlot $movedTo = null): void
    {
        $mg->status = MeetAndGreetStatus::Ended->value;
        $mg->ended_at = now();
        $mg->ended_by_user_id = $by->id;
        $mg->end_reason = $reason->value;
        $mg->end_details = $details;
        $mg->proposed_slot_id = $movedTo?->id;
        $mg->save();
    }

    /**
     * Booking is open again: the request is Approved, with a fresh 14 days to book (MG-06, MG-09, MG-10). When that
     * takes it back from Meet Scheduled, the change of status is logged like every other (FR27, SEC-LOG-01).
     */
    private function reopenBooking(AdoptionRequest $ar, string $reason, Request $request): void
    {
        $before = $ar->getStatus()->value;

        $ar->status = AdoptionRequestStatus::Approved->value;
        $ar->meet_scheduled_at = null;
        $ar->expires_at = now()->addDays(self::BOOKING_WINDOW_DAYS);
        $ar->save();

        if ($before !== AdoptionRequestStatus::Approved->value) {
            ActivityLogger::log(
                type: ActivityLogType::StatusChange,
                action: 'adoption_request_booking_reopened',
                actor: null,
                subject: $ar,
                before: $before,
                after: AdoptionRequestStatus::Approved->value,
                reason: $reason,
                userAgent: $request->userAgent(),
            );
        }
    }

    /** The request as it stands now, with its Meet & Greet, the open slots and the contact details it unlocks. */
    private function answer(AdoptionRequest $ar, Request $request, int $status = 200)
    {
        $data = (new AdoptionRequestResource($ar->fresh(['pet.photos', 'homeProfile.householdMembers'])))
            ->withDetails()
            ->toArray($request);

        return ($status === 201 ? ResponseResource::created($data) : ResponseResource::make($data))->toResponse($request);
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
