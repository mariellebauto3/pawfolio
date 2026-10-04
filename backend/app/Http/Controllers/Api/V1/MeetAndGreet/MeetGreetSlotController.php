<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\MeetAndGreet;

use App\Enums\ActivityLogType;
use App\Enums\AdoptionRequestStatus;
use App\Enums\MeetGreetPlaceType;
use App\Http\Controllers\Controller;
use App\Http\Resources\AdoptionRequests\AdoptionRequestResource;
use App\Http\Resources\ErrorResource;
use App\Http\Resources\ResponseResource;
use App\Models\AdoptionRequest;
use App\Models\MeetGreetSlot;
use App\Services\ActivityLogs\ActivityLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Human Meet & Greet availability slots CRUD and repeat slot generation (BE-17, MG-01, MG-02).
 */
class MeetGreetSlotController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        if ($user->isHuman() && $user->homeProfile) {
            $home = $user->homeProfile;

            $slots = $home->meetAndGreetSlots()
                ->available()
                ->with(['bookings.request.pet.photos'])
                ->orderBy('starts_at')
                ->get()
                ->map(function (MeetGreetSlot $slot): array {
                    $activeBooking = $slot->bookings->firstWhere(
                        fn ($b) => in_array($b->getStatus()->value, ['booked', 'confirmed'], true),
                    );

                    return [
                        'id' => $slot->id,
                        'home_profile_id' => $slot->home_profile_id,
                        'starts_at' => $slot->starts_at?->toISOString(),
                        'place_type' => $slot->placeType()->value,
                        'place_details' => $slot->place_details,
                        'is_booked' => $activeBooking !== null,
                        'active_booking' => $activeBooking ? [
                            'id' => $activeBooking->id,
                            'status' => $activeBooking->getStatus()->value,
                            'adoption_request_id' => $activeBooking->adoption_request_id,
                            'pet_name' => $activeBooking->request?->pet?->name,
                        ] : null,
                    ];
                })
                ->values()
                ->all();

            return ResponseResource::collection($slots);
        }

        if ($user->isPet() && $user->pet && $request->filled('home_profile_id')) {
            $homeProfileId = (int) $request->query('home_profile_id');

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
                ->available()
                ->where('home_profile_id', $homeProfileId)
                ->where('starts_at', '>', now())
                ->whereDoesntHave('bookings', fn ($q) => $q->whereIn('status', ['booked', 'confirmed']))
                ->orderBy('starts_at')
                ->get()
                ->map(fn (MeetGreetSlot $slot) => AdoptionRequestResource::formatSlot($slot))
                ->values()
                ->all();

            return ResponseResource::collection($slots);
        }

        return ErrorResource::forbidden('Only Furparent accounts can manage Meet & Greet availability slots.')->toResponse($request);
    }

    public function store(Request $request)
    {
        $user = $request->user();

        if (! $user->isHuman() || ! $user->homeProfile) {
            return ErrorResource::forbidden('Only Furparent accounts can add Meet & Greet slots.')->toResponse($request);
        }

        $validated = $request->validate([
            'starts_at' => ['required', 'date', 'after:now'],
            'place_type' => ['required', 'string', Rule::in(array_map(fn ($c) => $c->value, MeetGreetPlaceType::cases()))],
            'place_details' => ['required', 'string', 'max:255'],
            'repeat' => ['nullable', 'string', 'in:none,weekly_2,weekly_3,weekly_4'],
            'repeat_weeks' => ['nullable', 'integer', 'min:1', 'max:4'],
        ]);

        $weeks = 1;
        if (isset($validated['repeat_weeks'])) {
            $weeks = (int) $validated['repeat_weeks'];
        } elseif (! empty($validated['repeat'])) {
            $weeks = match ($validated['repeat']) {
                'weekly_2' => 2,
                'weekly_3' => 3,
                'weekly_4' => 4,
                default => 1,
            };
        }

        $baseTime = Carbon::parse($validated['starts_at']);
        $home = $user->homeProfile;

        $created = DB::transaction(function () use ($home, $baseTime, $weeks, $validated, $user, $request): array {
            $rows = [];
            for ($i = 0; $i < $weeks; $i++) {
                $slotTime = $baseTime->copy()->addWeeks($i);

                $slot = new MeetGreetSlot;
                $slot->home_profile_id = $home->id;
                $slot->starts_at = $slotTime;
                $slot->place_type = $validated['place_type'];
                $slot->place_details = trim($validated['place_details']);
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

            return $rows;
        });

        return ResponseResource::created(count($created) === 1 ? $created[0] : ['slots' => $created]);
    }

    public function destroy(Request $request, MeetGreetSlot $slot)
    {
        $user = $request->user();

        if (! $user->isHuman() || ! $user->homeProfile || $slot->home_profile_id !== $user->homeProfile->id || $slot->deleted_at !== null) {
            return ErrorResource::notFound('Slot not found.')->toResponse($request);
        }

        if ($slot->activeBooking() !== null) {
            return ErrorResource::conflict(
                'Cannot delete a slot that has an active Meet & Greet booking. Cancel or reschedule the booking first.',
                'slot_has_active_booking',
            )->toResponse($request);
        }

        $slot->deleted_at = now();
        $slot->save();

        return ResponseResource::make(['deleted' => true]);
    }
}
