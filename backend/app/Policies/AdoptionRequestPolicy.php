<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\AdoptionRequest;
use App\Models\User;

/**
 * Who may use adoption requests: the pet that sends them (RQ-03…RQ-08, RQ-14…RQ-17, FR24, FR25) and the human that
 * answers them (RQ-09…RQ-13, FR10) and decides after the Meet & Greet (MG-11…MG-14, AL-01, FR12). A request is
 * between one pet and one human: only those two and admins read it (SEC-AUTHZ-03), and anyone else is answered 404,
 * so ids can't be probed (SEC-AUTHZ-04). The rules of sending (3 open, 1 in process, the cooldown), of answering
 * (still Sent, not expired) and of deciding (the meeting time has passed) are the controller's, inside its
 * transaction.
 */
class AdoptionRequestPolicy
{
    /** My requests and the human's inbox. An admin has the monitor under /admin instead (RQ-18). */
    public function viewAny(User $user): bool
    {
        return $user->isActive() && ($user->isPet() || $user->isHuman());
    }

    public function view(User $user, AdoptionRequest $request): bool
    {
        return $user->isAdmin() || $this->sent($user, $request) || $this->received($user, $request);
    }

    /** Only a pet applies (proposal §9). */
    public function create(User $user): bool
    {
        return $user->isActive() && $user->isPet() && $user->pet !== null;
    }

    /** Only the pet that sent it (FR25). */
    public function withdraw(User $user, AdoptionRequest $request): bool
    {
        return $this->sent($user, $request);
    }

    /** Only the human it was sent to (FR10). Whether its status still allows an answer is the controller's to say. */
    public function approve(User $user, AdoptionRequest $request): bool
    {
        return $this->received($user, $request);
    }

    public function decline(User $user, AdoptionRequest $request): bool
    {
        return $this->received($user, $request);
    }

    /** Only the pet that sent it books a slot (MG-03, FR26). */
    public function bookMeeting(User $user, AdoptionRequest $request): bool
    {
        return $this->sent($user, $request);
    }

    /** Only the human it was sent to confirms a booking or proposes another time (MG-05, MG-06, FR11). */
    public function answerBooking(User $user, AdoptionRequest $request): bool
    {
        return $this->received($user, $request);
    }

    /** Either side reschedules or cancels its Meet & Greet (MG-09, MG-10, FR11, FR26). Admins only monitor. */
    public function changeMeeting(User $user, AdoptionRequest $request): bool
    {
        return $this->sent($user, $request) || $this->received($user, $request);
    }

    /**
     * Only the human it was sent to decides after the Meet & Greet: Adopt, Decline, or "It didn't happen" (MG-11,
     * MG-13, MG-14, AL-01, FR12). Whether the meeting time has passed is the controller's to say.
     */
    public function decide(User $user, AdoptionRequest $request): bool
    {
        return $this->received($user, $request);
    }

    private function sent(User $user, AdoptionRequest $request): bool
    {
        return $user->isPet() && $user->pet !== null && $request->pet_id === $user->pet->id;
    }

    private function received(User $user, AdoptionRequest $request): bool
    {
        return $user->isHuman() && $user->homeProfile !== null && $request->home_profile_id === $user->homeProfile->id;
    }
}
