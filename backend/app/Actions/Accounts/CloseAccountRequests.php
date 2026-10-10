<?php

declare(strict_types=1);

namespace App\Actions\Accounts;

use App\Enums\ActivityLogType;
use App\Enums\AdoptionRequestStatus;
use App\Enums\MeetAndGreetEndReason;
use App\Enums\MeetAndGreetStatus;
use App\Enums\NotificationType;
use App\Http\Controllers\Api\V1\AdoptionRequests\AdoptionRequestController;
use App\Models\AdoptionRequest;
use App\Models\User;
use App\Services\ActivityLogs\ActivityLogger;
use App\Services\Notifications\NotificationService;

/**
 * Closes every open adoption request of an account that leaves the platform: suspended, or deactivated by its owner
 * or by an admin (proposal §5.3, "Closed": "an account was suspended"). A booked Meet & Greet ends with the request,
 * the other side is told, and a pet that was In Process with a human who left is Looking for a Home again, its
 * requests On Hold back to Sent. Call it inside the transaction that changes the account's status.
 */
class CloseAccountRequests
{
    public function __construct(
        private readonly NotificationService $notifications,
    ) {}

    /**
     * @param  User|null  $actor  the admin, or the owner closing their own account
     * @param  string  $why  kept in the activity log, e.g. "Account suspended"
     * @return int how many requests were closed
     */
    public function handle(User $account, ?User $actor, string $why): int
    {
        $account->loadMissing(['pet', 'homeProfile']);
        $petId = $account->pet?->id;
        $homeId = $account->homeProfile?->id;

        // An account with neither a pet nor a home (an admin) has no requests: never fall through to every request.
        if ($petId === null && $homeId === null) {
            return 0;
        }

        $requests = AdoptionRequest::query()
            ->with(['pet.user.notificationPreference', 'homeProfile.user.notificationPreference', 'activeMeetAndGreet'])
            ->open()
            ->where(function ($query) use ($petId, $homeId): void {
                $query->where('pet_id', $petId ?? 0)->orWhere('home_profile_id', $homeId ?? 0);
            })
            ->lockForUpdate()
            ->get();

        $petsToRelease = [];

        foreach ($requests as $request) {
            $before = $request->getStatus()->value;

            if ($request->isInProcess() && $request->pet) {
                $petsToRelease[$request->pet->id] = $request->pet;
            }

            if ($meeting = $request->activeMeetAndGreet) {
                $meeting->status = MeetAndGreetStatus::Ended->value;
                $meeting->ended_at = now();
                $meeting->ended_by_user_id = $actor?->id;
                $meeting->end_reason = MeetAndGreetEndReason::Other->value;
                $meeting->end_details = $why;
                $meeting->save();
            }

            $request->status = AdoptionRequestStatus::Closed->value;
            $request->closed_at = now();
            $request->expires_at = null;
            $request->save();

            ActivityLogger::log(
                type: ActivityLogType::Request,
                action: 'adoption_request_closed',
                actor: $actor,
                subject: $request,
                before: $before,
                after: AdoptionRequestStatus::Closed->value,
                reason: $why,
            );

            $this->tellTheOtherSide($request, $account);
        }

        foreach ($petsToRelease as $pet) {
            AdoptionRequestController::releasePetFromInProcess($pet, $why);
        }

        return $requests->count();
    }

    /** The other side learns that the request ended, never why the account left (SEC-PRIV-04). */
    private function tellTheOtherSide(AdoptionRequest $request, User $leaving): void
    {
        $leavingIsPet = $request->pet?->user_id === $leaving->id;
        $recipient = $leavingIsPet ? $request->homeProfile?->user : $request->pet?->user;
        $leavingName = $leavingIsPet ? $request->pet?->name : $request->homeProfile?->full_name;

        if (! $recipient || $recipient->id === $leaving->id) {
            return;
        }

        $preference = $recipient->notificationPreference;
        if ($preference && ! $preference->shouldRequestAndInvite()) {
            return;
        }

        $this->notifications->store(
            recipient: $recipient,
            type: NotificationType::RequestDeclined->value,
            title: "The adoption request with {$leavingName} was closed",
            body: "{$leavingName} is no longer on Pawfolio, so the request was closed.",
            data: [
                'category' => 'Requests',
                'adoption_request_id' => $request->id,
                'pet_id' => $request->pet_id,
                'home_profile_id' => $request->home_profile_id,
                'link' => "/requests/{$request->id}",
            ],
            urgency: 'info',
            actionUrl: "/requests/{$request->id}",
        );
    }
}
