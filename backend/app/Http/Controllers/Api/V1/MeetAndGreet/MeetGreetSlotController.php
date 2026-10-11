<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\MeetAndGreet;

use App\Enums\ActivityLogType;
use App\Enums\AdoptionRequestStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\MeetAndGreet\ListMeetGreetSlotsRequest;
use App\Http\Requests\MeetAndGreet\StoreMeetGreetSlotRequest;
use App\Http\Resources\AdoptionRequests\AdoptionRequestResource;
use App\Http\Resources\ErrorResource;
use App\Http\Resources\ResponseResource;
use App\Models\AdoptionRequest;
use App\Models\HomeProfile;
use App\Models\MeetAndGreet;
use App\Models\MeetGreetSlot;
use App\Services\ActivityLogs\ActivityLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * A human's Meet & Greet availability (BE-17, MG-01, MG-02, FR11, docs/api/adoption-and-meet-greet.md): the slots
 * still ahead with who booked them, the Meet & Greets already behind, adding slots and removing open ones. A human
 * only ever reads and changes their own; the home comes from the session (SEC-AUTHZ-02).
 */
class MeetGreetSlotController extends Controller
{
    public function index(ListMeetGreetSlotsRequest $request)
    {
        $user = $request->user();

        if ($user->isHuman() && $user->homeProfile) {
            return $request->isPast() ? $this->pastMeetings($request, $user->homeProfile) : $this->upcomingSlots($request, $user->homeProfile);
        }

        if ($user->isPet() && $user->pet && $request->homeProfileId() !== null) {
            $homeProfileId = $request->homeProfileId();

            $hasApprovedRequest = AdoptionRequest::query()
                ->where('pet_id', $user->pet->id)
                ->where('home_profile_id', $homeProfileId)
                ->whereIn('status', [
                    AdoptionRequestStatus::Approved->value,
                    AdoptionRequestStatus::MeetScheduled->value,
                ])
                ->exists();

            if (! $hasApprovedRequest) {
                return ErrorResource::forbidden('You can only view slots for a home that approved your request.')->toResponse($request);
            }

            $slots = MeetGreetSlot::query()
                ->bookable()
                ->where('home_profile_id', $homeProfileId)
                ->orderBy('starts_at')
                ->limit(ListMeetGreetSlotsRequest::MAX_PER_PAGE)
                ->get()
                ->map(fn (MeetGreetSlot $slot) => AdoptionRequestResource::formatSlot($slot))
                ->values()
                ->all();

            return ResponseResource::collection($slots);
        }

        return ErrorResource::forbidden('Only a human account keeps Meet & Greet slots.')->toResponse($request);
    }

    /** MG-01 "Upcoming slots": every slot still ahead, soonest first, open or booked, with the pet that booked it. */
    private function upcomingSlots(ListMeetGreetSlotsRequest $request, HomeProfile $home)
    {
        $paginator = $home->meetAndGreetSlots()
            ->available()
            ->where('starts_at', '>', now())
            ->with(['bookings' => fn ($bookings) => $bookings->active()->with('request.pet')])
            ->orderBy('starts_at')
            ->orderBy('id')
            ->paginate($request->perPage());

        $items = $paginator->getCollection()
            ->map(function (MeetGreetSlot $slot): array {
                $booking = $slot->bookings->first();

                return [
                    ...AdoptionRequestResource::formatSlot($slot),
                    'is_booked' => $booking !== null,
                    'active_booking' => $booking ? [
                        'id' => $booking->id,
                        'status' => $booking->getStatus()->value,
                        'adoption_request_id' => $booking->adoption_request_id,
                        'pet_name' => $booking->request?->pet?->name,
                    ] : null,
                ];
            })
            ->values()
            ->all();

        return ResponseResource::paginated($paginator, $items);
    }

    /**
     * MG-01 "Past Meet & Greets": the confirmed meetings whose time has come, latest first, with where each request
     * stands now. A meeting called off before its time never took place, so it isn't one of them.
     */
    private function pastMeetings(ListMeetGreetSlotsRequest $request, HomeProfile $home)
    {
        $paginator = MeetAndGreet::query()
            ->select('meet_and_greets.*')
            ->join('meet_greet_slots', 'meet_greet_slots.id', '=', 'meet_and_greets.meet_greet_slot_id')
            ->where('meet_greet_slots.home_profile_id', $home->id)
            ->where('meet_greet_slots.starts_at', '<=', now())
            ->whereNotNull('meet_and_greets.confirmed_at')
            ->where(fn ($ended) => $ended
                ->whereNull('meet_and_greets.ended_at')
                ->orWhereColumn('meet_and_greets.ended_at', '>=', 'meet_greet_slots.starts_at'))
            ->with(['slot', 'request.pet'])
            ->orderByDesc('meet_greet_slots.starts_at')
            ->orderByDesc('meet_and_greets.id')
            ->paginate($request->perPage());

        $items = $paginator->getCollection()
            ->map(fn (MeetAndGreet $mg): array => [
                'id' => $mg->id,
                'adoption_request_id' => $mg->adoption_request_id,
                'pet_name' => $mg->request?->pet?->name,
                'request_status' => $mg->request?->getStatus()->value,
                // Set when the human reported that it didn't happen (MG-13); null for a meeting that took place.
                'end_reason' => $mg->end_reason,
                'slot' => $mg->slot ? AdoptionRequestResource::formatSlot($mg->slot) : null,
            ])
            ->values()
            ->all();

        return ResponseResource::paginated($paginator, $items);
    }

    /** MG-02: one slot, or the same slot on each of up to 4 weeks in a row. Always answered as a list. */
    public function store(StoreMeetGreetSlotRequest $request)
    {
        $user = $request->user();

        if (! $user->isHuman() || ! $user->homeProfile) {
            return ErrorResource::forbidden('Only a human account keeps Meet & Greet slots.')->toResponse($request);
        }

        $home = $user->homeProfile;
        $times = [];
        for ($week = 0; $week < $request->weeks(); $week++) {
            $times[] = $request->startsAt()->addWeeks($week);
        }

        return DB::transaction(function () use ($home, $times, $user, $request) {
            // Two slots at the same time can't both be kept: a pet would book one, and the other would still look open.
            $taken = $home->meetAndGreetSlots()->available()->whereIn('starts_at', $times)->lockForUpdate()->exists();
            if ($taken) {
                $message = count($times) > 1 ? 'You already have a slot at that time in one of these weeks.' : 'You already have a slot at that time.';

                return ErrorResource::unprocessable($message, ['starts_at' => [$message]])->toResponse($request);
            }

            $rows = [];
            foreach ($times as $startsAt) {
                $slot = new MeetGreetSlot;
                $slot->home_profile_id = $home->id;
                $slot->starts_at = $startsAt;
                $slot->place_type = $request->placeType();
                $slot->place_details = $request->placeDetails();
                $slot->save();

                $rows[] = AdoptionRequestResource::formatSlot($slot);
            }

            ActivityLogger::log(
                type: ActivityLogType::MeetAndGreet,
                action: 'meet_greet_slots_added',
                actor: $user,
                subject: $home,
                after: count($rows).' slot(s)',
                userAgent: $request->userAgent(),
            );

            return ResponseResource::created($rows)->toResponse($request);
        });
    }

    public function destroy(Request $request, MeetGreetSlot $slot)
    {
        $user = $request->user();

        if (! $user->isHuman() || ! $user->homeProfile || $slot->home_profile_id !== $user->homeProfile->id || $slot->deleted_at !== null) {
            return ErrorResource::notFound("We couldn't find that slot.")->toResponse($request);
        }

        if ($slot->activeBooking() !== null) {
            return ErrorResource::conflict(
                'A pet has booked this slot. Propose another time or cancel the meeting on the request first.',
                'slot_has_active_booking',
            )->toResponse($request);
        }

        $slot->deleted_at = now();
        $slot->save();

        return ResponseResource::make(['deleted' => true]);
    }
}
