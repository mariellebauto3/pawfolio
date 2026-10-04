<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Adoption;

use App\Enums\ActivityLogType;
use App\Enums\AdoptionRequestDeclineReason;
use App\Enums\AdoptionRequestStatus;
use App\Enums\MeetAndGreetStatus;
use App\Enums\NotificationType;
use App\Enums\PetStatus;
use App\Enums\PostType;
use App\Http\Controllers\Api\V1\AdoptionRequests\AdoptionRequestController;
use App\Http\Controllers\Controller;
use App\Http\Resources\AdoptionRequests\AdoptionRequestResource;
use App\Http\Resources\ErrorResource;
use App\Http\Resources\Profiles\HomeProfileResource;
use App\Http\Resources\Profiles\PetResource;
use App\Http\Resources\ResponseResource;
use App\Models\Adoption;
use App\Models\AdoptionRequest;
use App\Models\MatchScore;
use App\Models\Pet;
use App\Models\Post;
use App\Services\ActivityLogs\ActivityLogger;
use App\Services\Matching\MatchScoreCalculator;
use App\Services\Notifications\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Post-meeting decision (Adopt / Decline After Meeting) and Adoption record details (BE-18, MG-11, MG-14, AL-01..AL-06).
 */
class AdoptionController extends Controller
{
    public function __construct(
        private readonly NotificationService $notifications,
        private readonly MatchScoreCalculator $matcher,
    ) {}

    public function adopt(Request $request, AdoptionRequest $adoptionRequest)
    {
        $user = $request->user();

        if (! $user->isHuman() || ! $user->homeProfile || $adoptionRequest->home_profile_id !== $user->homeProfile->id) {
            return ErrorResource::forbidden('Only the Home Profile owner on this request can confirm adoption.')->toResponse($request);
        }

        $validated = $request->validate([
            'decision_message' => ['nullable', 'string', 'max:600'],
        ]);

        return DB::transaction(function () use ($adoptionRequest, $user, $validated, $request) {
            /** @var AdoptionRequest $ar */
            $ar = AdoptionRequest::query()
                ->with(['pet.user', 'pet.photos', 'homeProfile.user', 'activeMeetAndGreet.slot', 'latestMeetAndGreet.slot'])
                ->whereKey($adoptionRequest->id)
                ->lockForUpdate()
                ->firstOrFail();

            /** @var Pet $pet */
            $pet = Pet::query()->whereKey($ar->pet_id)->lockForUpdate()->firstOrFail();

            if (! $this->canMakePostMeetingDecision($ar)) {
                return ErrorResource::conflict(
                    'Adopt and Decline are available only after the scheduled Meet & Greet time has passed.',
                    'meeting_not_yet_passed',
                )->toResponse($request);
            }

            $now = now();
            $beforeRequestStatus = $ar->getStatus()->value;
            $beforePetStatus = $pet->getStatusEnum()->value;

            if ($ar->activeMeetAndGreet) {
                $mg = $ar->activeMeetAndGreet;
                $mg->status = MeetAndGreetStatus::Ended->value;
                $mg->ended_at = $now;
                $mg->ended_by_user_id = $user->id;
                $mg->save();
            }

            $ar->status = AdoptionRequestStatus::Adopted->value;
            $ar->decision_message = isset($validated['decision_message']) && trim($validated['decision_message']) !== ''
                ? trim($validated['decision_message'])
                : null;
            $ar->closed_at = $now;
            $ar->expires_at = null;
            $ar->overdue_flagged_at = null;
            $ar->save();

            $pet->status = PetStatus::AdoptedHired;
            $pet->save();

            $home = $ar->homeProfile;
            if ($home->furparent_at === null) {
                $home->furparent_at = $now;
            }
            $home->is_open_to_adopt = false;
            $home->save();

            $adoption = new Adoption;
            $adoption->pet_id = $pet->id;
            $adoption->home_profile_id = $home->id;
            $adoption->adoption_request_id = $ar->id;
            $adoption->adopted_at = $now;
            $adoption->save();

            // Close all other open / on_hold requests for this pet (AL-01).
            $otherOpenRequests = AdoptionRequest::query()
                ->with('homeProfile.user')
                ->where('pet_id', $pet->id)
                ->where('id', '!=', $ar->id)
                ->open()
                ->lockForUpdate()
                ->get();

            foreach ($otherOpenRequests as $other) {
                $other->status = AdoptionRequestStatus::Closed->value;
                $other->closed_at = $now;
                $other->expires_at = null;
                $other->save();

                if ($other->homeProfile?->user) {
                    $this->notifications->store(
                        recipient: $other->homeProfile->user,
                        type: NotificationType::RequestDeclined->value,
                        title: "{$pet->name} has been adopted",
                        body: "{$pet->name} found a forever home, so your open request has been closed.",
                        data: [
                            'category' => 'Requests',
                            'adoption_request_id' => $other->id,
                            'pet_id' => $pet->id,
                            'link' => "/requests/{$other->id}",
                        ],
                        urgency: 'info',
                        actionUrl: "/requests/{$other->id}",
                    );
                }
            }

            // Alumni don't appear in search or matches (DS-08).
            MatchScore::query()->where('pet_id', $pet->id)->delete();

            // Automatically create a "Hired" post on the community feed (FR28, AL-03).
            if ($pet->user) {
                $post = new Post;
                $post->author_user_id = $pet->user_id;
                $post->adopted_pet_id = $pet->id;
                $post->type = PostType::Hired->value;
                $post->title = "{$pet->name} got Hired by {$home->full_name}!";
                $post->body = "I officially have a forever home with {$home->full_name} in {$home->city}! #GotHired #PawfolioAlumni";
                $post->save();

                $firstPhoto = $pet->photos->sortBy('sort_order')->first();
                if ($firstPhoto) {
                    $post->photos()->create([
                        'file_path' => $firstPhoto->file_path,
                        'sort_order' => 1,
                    ]);
                }

                $this->notifications->store(
                    recipient: $pet->user,
                    type: NotificationType::RequestApproved->value,
                    title: "{$pet->name} got Hired!",
                    body: "{$home->full_name} confirmed the adoption of {$pet->name}. Congratulations!",
                    data: [
                        'category' => 'Requests',
                        'adoption_request_id' => $ar->id,
                        'adoption_id' => $adoption->id,
                        'pet_id' => $pet->id,
                        'link' => "/requests/{$ar->id}",
                    ],
                    urgency: 'info',
                    actionUrl: "/requests/{$ar->id}",
                );
            }

            ActivityLogger::log(
                type: ActivityLogType::Adoption,
                action: 'adoption_confirmed',
                actor: $user,
                subject: $adoption,
                before: $beforeRequestStatus,
                after: AdoptionRequestStatus::Adopted->value,
                userAgent: $request->userAgent(),
            );

            ActivityLogger::log(
                type: ActivityLogType::StatusChange,
                action: 'pet_adopted_hired',
                actor: null,
                subject: $pet,
                before: $beforePetStatus,
                after: PetStatus::AdoptedHired->value,
                reason: "Adopted by {$home->full_name} (Request #{$ar->id})",
                userAgent: $request->userAgent(),
            );

            return ResponseResource::make([
                'adoption_id' => $adoption->id,
                'adopted_at' => $adoption->adopted_at->toISOString(),
                'request' => (new AdoptionRequestResource($ar->fresh(['pet.photos', 'homeProfile', 'adoption'])))
                    ->withDetails()
                    ->toArray($request),
            ])->toResponse($request);
        });
    }

    public function declineAfterMeeting(Request $request, AdoptionRequest $adoptionRequest)
    {
        $user = $request->user();

        if (! $user->isHuman() || ! $user->homeProfile || $adoptionRequest->home_profile_id !== $user->homeProfile->id) {
            return ErrorResource::forbidden('Only the Home Profile owner on this request can record a post-meeting decision.')->toResponse($request);
        }

        $validated = $request->validate([
            'decline_reason' => ['nullable', 'string', Rule::in(array_map(fn ($c) => $c->value, AdoptionRequestDeclineReason::cases()))],
            'decision_message' => ['nullable', 'string', 'max:600'],
        ]);

        $response = DB::transaction(function () use ($adoptionRequest, $user, $validated, $request) {
            /** @var AdoptionRequest $ar */
            $ar = AdoptionRequest::query()
                ->with(['pet.user', 'homeProfile', 'activeMeetAndGreet.slot', 'latestMeetAndGreet.slot'])
                ->whereKey($adoptionRequest->id)
                ->lockForUpdate()
                ->firstOrFail();

            if (! $this->canMakePostMeetingDecision($ar)) {
                return ErrorResource::conflict(
                    'Adopt and Decline are available only after the scheduled Meet & Greet time has passed.',
                    'meeting_not_yet_passed',
                )->toResponse($request);
            }

            $now = now();
            $beforeStatus = $ar->getStatus()->value;

            if ($ar->activeMeetAndGreet) {
                $mg = $ar->activeMeetAndGreet;
                $mg->status = MeetAndGreetStatus::Ended->value;
                $mg->ended_at = $now;
                $mg->ended_by_user_id = $user->id;
                $mg->save();
            }

            $ar->status = AdoptionRequestStatus::NotAdopted->value;
            $ar->decline_reason = $validated['decline_reason'] ?? null;
            $ar->decision_message = isset($validated['decision_message']) && trim($validated['decision_message']) !== ''
                ? trim($validated['decision_message'])
                : null;
            $ar->closed_at = $now;
            $ar->expires_at = null;
            $ar->overdue_flagged_at = null;
            $ar->save();

            if ($ar->pet) {
                AdoptionRequestController::releasePetFromInProcess($ar->pet, "Declined after Meet & Greet (Request #{$ar->id})");
            }

            if ($ar->pet?->user) {
                $this->notifications->store(
                    recipient: $ar->pet->user,
                    type: NotificationType::RequestDeclined->value,
                    title: "Decision after Meet & Greet with {$ar->homeProfile->full_name}",
                    body: "{$ar->homeProfile->full_name} decided not to proceed after the Meet & Greet. {$ar->pet->name} is Looking for a Home again.",
                    data: [
                        'category' => 'Requests',
                        'adoption_request_id' => $ar->id,
                        'pet_id' => $ar->pet_id,
                        'link' => "/requests/{$ar->id}",
                    ],
                    urgency: 'info',
                    actionUrl: "/requests/{$ar->id}",
                );
            }

            ActivityLogger::log(
                type: ActivityLogType::Request,
                action: 'adoption_request_not_adopted',
                actor: $user,
                subject: $ar,
                before: $beforeStatus,
                after: AdoptionRequestStatus::NotAdopted->value,
                reason: $ar->decline_reason,
                userAgent: $request->userAgent(),
            );

            return $ar;
        });

        if (! ($response instanceof AdoptionRequest)) {
            return $response;
        }

        if ($response->pet) {
            $this->matcher->recalculateForPet($response->pet->fresh());
        }

        return ResponseResource::make(
            (new AdoptionRequestResource($response->fresh(['pet.photos', 'homeProfile'])))
                ->withDetails()
                ->toArray($request),
        );
    }

    public function show(Request $request, Adoption $adoption)
    {
        $adoption->loadMissing(['pet.photos', 'homeProfile', 'request.latestMeetAndGreet.slot']);

        $ar = $adoption->request;
        $daysToAdoption = ($ar && $ar->sent_at && $adoption->adopted_at)
            ? max(1, (int) $ar->sent_at->diffInDays($adoption->adopted_at))
            : null;

        return ResponseResource::make([
            'id' => $adoption->id,
            'pet' => $adoption->pet ? PetResource::summary($adoption->pet) : null,
            'home_profile' => $adoption->homeProfile ? HomeProfileResource::summary($adoption->homeProfile) : null,
            'adoption_request_id' => $adoption->adoption_request_id,
            'adopted_at' => $adoption->adopted_at?->toISOString(),
            'link_removed_at' => $adoption->link_removed_at?->toISOString(),
            'days_to_adoption' => $daysToAdoption,
            'cover_letter' => $ar?->cover_letter,
            'timeline' => [
                'sent_at' => $ar?->sent_at?->toISOString(),
                'approved_at' => $ar?->approved_at?->toISOString(),
                'meet_scheduled_at' => $ar?->meet_scheduled_at?->toISOString(),
                'meet_starts_at' => $ar?->latestMeetAndGreet?->slot?->starts_at?->toISOString(),
                'adopted_at' => $adoption->adopted_at?->toISOString(),
            ],
        ]);
    }

    private function canMakePostMeetingDecision(AdoptionRequest $ar): bool
    {
        $status = $ar->getStatus();

        if ($status === AdoptionRequestStatus::AwaitingDecision) {
            return true;
        }

        if ($status === AdoptionRequestStatus::MeetScheduled) {
            $mg = $ar->activeMeetAndGreet ?? $ar->latestMeetAndGreet;
            if ($mg && $mg->slot && $mg->slot->starts_at && $mg->slot->starts_at->isPast()) {
                return true;
            }
        }

        return false;
    }
}
