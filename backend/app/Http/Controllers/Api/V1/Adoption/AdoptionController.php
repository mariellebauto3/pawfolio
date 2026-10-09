<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Adoption;

use App\Enums\ActivityLogType;
use App\Enums\AdoptionRequestStatus;
use App\Enums\MeetAndGreetStatus;
use App\Enums\NotificationType;
use App\Enums\PetStatus;
use App\Enums\PostType;
use App\Http\Controllers\Api\V1\AdoptionRequests\AdoptionRequestController;
use App\Http\Controllers\Controller;
use App\Http\Requests\Adoption\AdoptPetRequest;
use App\Http\Requests\Adoption\DeclineAfterMeetingRequest;
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
use App\Models\User;
use App\Services\ActivityLogs\ActivityLogger;
use App\Services\Matching\MatchScoreCalculator;
use App\Services\Notifications\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * The decision after a Meet & Greet and the adoption it can end in (BE-18, MG-11, MG-14, AL-01…AL-06, FR12, FR13,
 * FR14, FR28, docs/api/adoption-and-meet-greet.md): the human adopts or declines once the meeting time has passed,
 * and the two sides read the adoption record afterwards. Only the human a request was sent to decides; anyone else is
 * answered 404 (SEC-AUTHZ-04). Reporting that the meeting didn't happen (MG-13) is MeetAndGreetController's.
 */
class AdoptionController extends Controller
{
    public function __construct(
        private readonly NotificationService $notifications,
        private readonly MatchScoreCalculator $matcher,
    ) {}

    /**
     * AL-01: the human adopts. In one transaction the request becomes Adopted, the pet Adopted — Hired and linked to
     * its one Furparent, the human a Furparent, and the pet's other open requests close (§5.5, FR13, FR28). Nobody
     * sets any of it by hand (FR27).
     */
    public function adopt(AdoptPetRequest $request, int $adoptionRequest)
    {
        $user = $request->user();
        $found = $this->requestFor($user, $adoptionRequest);
        if ($found === null) {
            return $this->notFound($request);
        }

        return DB::transaction(function () use ($found, $user, $request) {
            $ar = $this->locked($found, ['pet.user', 'pet.photos', 'homeProfile', 'activeMeetAndGreet.slot', 'latestMeetAndGreet.slot']);

            /** @var Pet $pet */
            $pet = Pet::query()->with(['user', 'photos'])->whereKey($ar->pet_id)->lockForUpdate()->firstOrFail();

            if ($problem = $this->decisionProblem($ar)) {
                return $problem->toResponse($request);
            }

            // A pet has exactly one Furparent (§5.5). The pet's row is locked, so two adoptions can't both pass
            // (SEC-AUTHZ-08).
            if ($pet->getStatusEnum() === PetStatus::AdoptedHired || Adoption::query()->where('pet_id', $pet->id)->active()->exists()) {
                return ErrorResource::conflict("{$pet->name} has already been adopted.", 'already_adopted')->toResponse($request);
            }

            $now = now();
            $beforeRequestStatus = $ar->getStatus()->value;
            $beforePetStatus = $pet->getStatusEnum()->value;

            $this->endMeeting($ar);

            $ar->status = AdoptionRequestStatus::Adopted->value;
            $ar->decision_message = $request->message();
            $ar->closed_at = $now;
            $ar->expires_at = null;
            $ar->overdue_flagged_at = null;
            $ar->save();

            $pet->status = PetStatus::AdoptedHired;
            $pet->save();

            // A Furparent since their first adoption, and for good (§5.5). Open to Adopt goes off with it: the human
            // turns it on again when they want another pet's requests.
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

            // The pet's other open requests close, the ones On Hold included (FR28).
            $others = AdoptionRequest::query()
                ->with('homeProfile.user')
                ->where('pet_id', $pet->id)
                ->where('id', '!=', $ar->id)
                ->open()
                ->lockForUpdate()
                ->get();

            foreach ($others as $other) {
                $beforeOther = $other->getStatus()->value;
                $other->status = AdoptionRequestStatus::Closed->value;
                $other->closed_at = $now;
                $other->expires_at = null;
                $other->save();

                ActivityLogger::log(
                    type: ActivityLogType::StatusChange,
                    action: 'adoption_request_closed',
                    actor: null,
                    subject: $other,
                    before: $beforeOther,
                    after: AdoptionRequestStatus::Closed->value,
                    reason: "{$pet->name} was adopted by another home (Request #{$ar->id})",
                    userAgent: $request->userAgent(),
                );

                if ($other->homeProfile?->user) {
                    $this->notify(
                        recipient: $other->homeProfile->user,
                        type: NotificationType::RequestDeclined->value,
                        title: "{$pet->name} has been adopted",
                        body: "{$pet->name} found a home, so the request it sent you was closed.",
                        ar: $other,
                    );
                }
            }

            // Alumni don't appear in search or matches (§5.5, DS-08).
            MatchScore::query()->where('pet_id', $pet->id)->delete();

            if ($pet->user) {
                // The pet's own "Hired" post on the community feed (FR28, AL-03).
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

                $this->notify(
                    recipient: $pet->user,
                    type: NotificationType::RequestApproved->value,
                    title: 'You got Hired!',
                    body: "{$home->full_name} adopted you. Your profile is now an alumni profile, and your other open requests were closed.",
                    ar: $ar,
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

            return $this->answer($ar, $request);
        });
    }

    /**
     * MG-14: the human declines after the meeting. The request ends as Not Adopted, the pet goes back to Looking for
     * a Home with its requests On Hold restored to Sent, and the 30-day cooldown with this home starts (§5.5).
     */
    public function declineAfterMeeting(DeclineAfterMeetingRequest $request, int $adoptionRequest)
    {
        $user = $request->user();
        $found = $this->requestFor($user, $adoptionRequest);
        if ($found === null) {
            return $this->notFound($request);
        }

        $declined = DB::transaction(function () use ($found, $user, $request) {
            $ar = $this->locked($found, ['pet.user', 'homeProfile', 'activeMeetAndGreet.slot', 'latestMeetAndGreet.slot']);

            if ($problem = $this->decisionProblem($ar)) {
                return $problem->toResponse($request);
            }

            $beforeStatus = $ar->getStatus()->value;

            $this->endMeeting($ar);

            $ar->status = AdoptionRequestStatus::NotAdopted->value;
            $ar->decline_reason = $request->reason();
            $ar->decision_message = $request->message();
            $ar->closed_at = now();
            $ar->expires_at = null;
            $ar->overdue_flagged_at = null;
            $ar->save();

            if ($ar->pet) {
                AdoptionRequestController::releasePetFromInProcess($ar->pet, "Declined after Meet & Greet (Request #{$ar->id})");
            }

            if ($ar->pet?->user) {
                $this->notify(
                    recipient: $ar->pet->user,
                    type: NotificationType::RequestDeclined->value,
                    title: "{$ar->homeProfile->full_name} decided not to adopt",
                    body: "{$ar->homeProfile->full_name} decided not to adopt after the Meet & Greet. You're Looking for a Home again.",
                    ar: $ar,
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

        if (! ($declined instanceof AdoptionRequest)) {
            return $declined;
        }

        // Looking for a Home again: back in search and matches.
        if ($declined->pet) {
            $this->matcher->recalculateForPet($declined->pet->fresh());
        }

        return $this->answer($declined, $request);
    }

    /**
     * AL-06: the adoption record, for the pet, its Furparent and admins: who is linked to whom, the request's
     * milestones, the Meet & Greet that took place, the days from the request to the adoption, and the cover letter.
     */
    public function show(Request $request, int $adoption)
    {
        $found = Adoption::query()
            ->with(['pet.photos', 'homeProfile', 'request.latestMeetAndGreet.slot'])
            ->find($adoption);

        // Someone else's adoption answers like one that doesn't exist (AdoptionPolicy, SEC-AUTHZ-04).
        if ($found === null || $request->user()->cannot('view', $found)) {
            return ErrorResource::notFound("We couldn't find that adoption.")->toResponse($request);
        }

        $ar = $found->request;
        $meeting = $ar?->latestMeetAndGreet?->slot;

        return ResponseResource::make([
            'id' => $found->id,
            'pet' => $found->pet ? PetResource::summary($found->pet) : null,
            'home_profile' => $found->homeProfile ? HomeProfileResource::summary($found->homeProfile) : null,
            'adoption_request_id' => $found->adoption_request_id,
            'adopted_at' => $found->adopted_at?->toISOString(),
            'link_removed_at' => $found->link_removed_at?->toISOString(),
            // Counted in whole days from the day the request was sent; an adoption on that same day is 1.
            'days_to_adoption' => ($ar?->sent_at && $found->adopted_at)
                ? max(1, (int) $ar->sent_at->diffInDays($found->adopted_at))
                : null,
            'cover_letter' => $ar?->cover_letter,
            'timeline' => [
                'sent_at' => $ar?->sent_at?->toISOString(),
                'approved_at' => $ar?->approved_at?->toISOString(),
                'meet_scheduled_at' => $ar?->meet_scheduled_at?->toISOString(),
                'meet_starts_at' => $meeting?->starts_at?->toISOString(),
                'adopted_at' => $found->adopted_at?->toISOString(),
            ],
            // When and where the two met. Never an address: a slot's place is a public spot, a shelter, or "the
            // caretaker's location" without one (SEC-PRIV-02).
            'meeting' => $meeting ? AdoptionRequestResource::formatSlot($meeting) : null,
        ]);
    }

    /**
     * The request, when the caller is the human who decides on it. Anyone else is answered like a request that
     * doesn't exist, so ids can't be probed (AdoptionRequestPolicy, SEC-AUTHZ-04).
     */
    private function requestFor(User $user, int $id): ?AdoptionRequest
    {
        $found = AdoptionRequest::query()->find($id);

        return $found !== null && $user->can('decide', $found) ? $found : null;
    }

    private function notFound(Request $request)
    {
        return ErrorResource::notFound("We couldn't find that request.")->toResponse($request);
    }

    /** The request read again inside the transaction, its row locked, so two decisions at once can't both pass (SEC-AUTHZ-08). */
    private function locked(AdoptionRequest $found, array $with): AdoptionRequest
    {
        return AdoptionRequest::query()->with($with)->whereKey($found->id)->lockForUpdate()->firstOrFail();
    }

    /**
     * Why the human can't decide on this request now, or null when they can: Adopt and Decline open only once the
     * confirmed meeting's time has passed (§5.4, FR12, NFR3).
     */
    private function decisionProblem(AdoptionRequest $ar): ?ErrorResource
    {
        if ($ar->meetingHasPassed()) {
            return null;
        }

        return $ar->getStatus() === AdoptionRequestStatus::MeetScheduled
            ? ErrorResource::conflict('You can decide once the Meet & Greet time has passed.', 'meeting_not_yet_passed')
            : ErrorResource::conflict("This request isn't waiting for a decision.", 'invalid_request_state');
    }

    /** The meeting took place and the decision closes it. Nobody called it off, so nobody is named as ending it. */
    private function endMeeting(AdoptionRequest $ar): void
    {
        $mg = $ar->activeMeetAndGreet;
        if ($mg === null) {
            return;
        }

        $mg->status = MeetAndGreetStatus::Ended->value;
        $mg->ended_at = now();
        $mg->save();
    }

    /** The request as it stands now, with what the decision opened or closed: the adoption, the cooldown, the contact details. */
    private function answer(AdoptionRequest $ar, Request $request)
    {
        return ResponseResource::make(
            (new AdoptionRequestResource($ar->fresh(['pet.photos', 'homeProfile.householdMembers'])))
                ->withDetails()
                ->toArray($request),
        )->toResponse($request);
    }

    private function notify(User $recipient, string $type, string $title, string $body, AdoptionRequest $ar): void
    {
        $prefs = $recipient->notificationPreference;
        if ($prefs && ! $prefs->shouldRequestAndInvite()) {
            return;
        }

        $this->notifications->store(
            recipient: $recipient,
            type: $type,
            title: $title,
            body: $body,
            data: [
                'category' => 'Requests',
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
