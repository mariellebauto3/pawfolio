<?php

declare(strict_types=1);

namespace App\Actions\AdoptionRequests;

use App\Enums\ActivityLogType;
use App\Enums\NotificationType;
use App\Enums\PetStatus;
use App\Exceptions\InviteRefused;
use App\Models\AdoptionRequest;
use App\Models\HomeProfile;
use App\Models\Invite;
use App\Models\Pet;
use App\Models\User;
use App\Services\ActivityLogs\ActivityLogger;
use App\Services\Notifications\NotificationService;
use Illuminate\Support\Facades\DB;

/**
 * A human invites a pet to apply (BE-15, RQ-01, FR9): a nudge, never a request. The pet reads it on Invites to Apply
 * (RQ-02) and is notified. An invite doesn't count toward the pet's 3 open requests.
 */
class SendInvite
{
    public function __construct(
        private readonly NotificationService $notifications,
    ) {}

    /**
     * @param  Pet  $pet  A pet the human may see (PetPolicy); the caller has checked.
     *
     * @throws InviteRefused
     */
    public function __invoke(User $human, Pet $pet, ?string $note, ?string $userAgent = null): Invite
    {
        return DB::transaction(function () use ($human, $pet, $note, $userAgent): Invite {
            // The sender's own home, locked, so two invites sent at once can't both pass the checks (SEC-AUTHZ-08).
            $home = HomeProfile::query()->where('user_id', $human->id)->lockForUpdate()->first();

            if ($home === null || ! $home->isOpenToAdopt() || ! $home->hasCompletedQuiz()) {
                throw InviteRefused::notOpenToAdopt();
            }

            if ($pet->getStatusEnum() !== PetStatus::LookingForAHome) {
                throw InviteRefused::petNotLooking($pet);
            }

            $pair = ['pet_id' => $pet->id, 'home_profile_id' => $home->id];

            // The pet has applied already, so there is nothing left to nudge.
            if (AdoptionRequest::query()->where($pair)->open()->exists()) {
                throw InviteRefused::alreadyApplied($pet);
            }

            // One live invite per pet and home. A dismissed one doesn't count, so the human may ask again.
            if (Invite::query()->where($pair)->active()->exists()) {
                throw InviteRefused::alreadySent($pet);
            }

            $invite = new Invite;
            $invite->pet_id = $pet->id;
            $invite->home_profile_id = $home->id;
            $invite->note = $note;
            $invite->save();

            $this->notify($invite, $pet, $home);

            ActivityLogger::log(
                type: ActivityLogType::Request,
                action: 'invite_to_apply_sent',
                actor: $human,
                subject: $invite,
                userAgent: $userAgent,
            );

            return $invite;
        });
    }

    /** Tells the pet, unless it turned "Adoption requests and invites" off in its settings (BE-10). */
    private function notify(Invite $invite, Pet $pet, HomeProfile $home): void
    {
        $recipient = $pet->user;
        $preferences = $recipient?->notificationPreference;

        if ($recipient === null || ($preferences !== null && ! $preferences->shouldRequestAndInvite())) {
            return;
        }

        $this->notifications->store(
            recipient: $recipient,
            type: NotificationType::InviteSent->value,
            title: "{$home->full_name} invited you to apply!",
            body: $invite->note !== null
                ? "\"{$invite->note}\" — {$home->full_name} invited {$pet->name} to apply."
                : "{$home->full_name} in {$home->city} invited {$pet->name} to apply for their home.",
            data: [
                'category' => 'Requests',
                'invite_id' => $invite->id,
                'home_profile_id' => $home->id,
                'pet_id' => $pet->id,
                'link' => '/invites',
            ],
            urgency: 'info',
            actionUrl: '/invites',
        );
    }
}
