<?php

declare(strict_types=1);

namespace App\Actions\Adoption;

use App\Enums\ActivityLogType;
use App\Enums\AdoptionAction;
use App\Enums\AdoptionRequestStatus;
use App\Enums\MeetAndGreetEndReason;
use App\Enums\MeetAndGreetStatus;
use App\Enums\NotificationType;
use App\Enums\PetStatus;
use App\Exceptions\ResolutionRefused;
use App\Http\Controllers\Api\V1\AdoptionRequests\AdoptionRequestController;
use App\Models\Adoption;
use App\Models\AdoptionRequest;
use App\Models\AdoptionResolution;
use App\Models\Pet;
use App\Models\User;
use App\Services\ActivityLogs\ActivityLogger;
use App\Services\Notifications\NotificationService;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Resolve adoption issue (AL-07, AL-08, FR37): the only way a pet's or a request's status changes outside the normal
 * flow (FR27, proposal §5.2). Each of the four actions applies to one situation and to nothing else:
 *
 * - Cancel adoption: the pet is Adopted. The Furparent link is removed, the adopted request is closed and the pet
 *   is Looking for a Home again. The human keeps the Furparent label (§5.5).
 * - Return pet to Looking for a Home: the pet is In Process. Its request in process is closed, a booked Meet & Greet
 *   ends, and its requests On Hold go back to Sent (§5.3).
 * - Close request: one request that is Sent or On Hold. Nothing else changes; a request in process is ended with
 *   "Return pet to Looking for a Home", which also frees the pet.
 * - Reopen Meet & Greet booking: a request that is Meet Scheduled or Awaiting Decision goes back to Approved, so the
 *   pet can book again. The pet stays In Process.
 *
 * `options()` says which of them a pet offers right now, `preview()` what one would change, and `handle()` applies
 * it: all three read the same rules, so the screen never offers what the API refuses (SEC-FE-05). Every change needs
 * a reason, is written to the activity log with the admin's name, and both accounts are told (NFR9, SEC-AUTHZ-07,
 * SEC-LOG-01).
 */
class ResolveAdoptionIssue
{
    /** The requests a pet's Resolve screen lists at most, newest first. */
    public const MAX_REQUESTS = 50;

    private const REOPENABLE = [AdoptionRequestStatus::MeetScheduled, AdoptionRequestStatus::AwaitingDecision];

    private const CLOSABLE = [AdoptionRequestStatus::Sent, AdoptionRequestStatus::OnHold];

    public function __construct(
        private readonly NotificationService $notifications,
    ) {}

    /**
     * What an admin can do for this pet now.
     *
     * @return array{furparent: array<string, mixed>|null, requests: list<array<string, mixed>>, actions: list<array<string, mixed>>}
     */
    public function options(Pet $pet): array
    {
        $requests = $this->requestsOf($pet);
        $link = $this->activeLink($pet);
        $rules = $this->rules($pet, $requests, $link);

        return [
            'furparent' => $link ? [
                'home_profile_id' => $link->home_profile_id,
                'full_name' => $link->homeProfile?->full_name,
                'adopted_at' => $link->adopted_at?->toISOString(),
                'adoption_request_id' => $link->adoption_request_id,
            ] : null,
            'requests' => $requests->take(self::MAX_REQUESTS)->map(fn (AdoptionRequest $ar): array => [
                'id' => $ar->id,
                'status' => $ar->getStatus()->value,
                'home_name' => $ar->homeProfile?->full_name,
                'sent_at' => $ar->sent_at?->toISOString(),
                'closed_at' => $ar->closed_at?->toISOString(),
            ])->values()->all(),
            'actions' => array_map(fn (AdoptionAction $action): array => [
                'action' => $action->value,
                'available' => $rules[$action->value]['available'],
                'request_ids' => $rules[$action->value]['request_ids'],
                'unavailable_reason' => $rules[$action->value]['available'] ? null : $rules[$action->value]['why_not'],
            ], AdoptionAction::cases()),
        ];
    }

    /**
     * What the action would change, before anything is written (AL-08).
     *
     * @return array<string, mixed>
     *
     * @throws ResolutionRefused when it doesn't apply to the pet or the request as they stand
     */
    public function preview(Pet $pet, AdoptionAction $action, ?int $requestId): array
    {
        return $this->describe($this->plan($pet, $action, $requestId));
    }

    /**
     * Applies the action in one transaction, the pet's row locked, so two admins can't both resolve the same issue
     * (SEC-AUTHZ-08).
     *
     * @return array{resolution: AdoptionResolution, change: array<string, mixed>}
     *
     * @throws ResolutionRefused when it no longer applies
     */
    public function handle(Pet $pet, User $admin, AdoptionAction $action, ?int $requestId, string $reason, ?string $userAgent = null): array
    {
        return DB::transaction(function () use ($pet, $admin, $action, $requestId, $reason, $userAgent): array {
            /** @var Pet $locked */
            $locked = Pet::query()->with('user')->whereKey($pet->id)->lockForUpdate()->firstOrFail();

            $plan = $this->plan($locked, $action, $requestId);
            $change = $this->describe($plan);
            /** @var AdoptionRequest|null $target */
            $target = $plan['target'];
            /** @var Adoption|null $link */
            $link = $plan['link'];
            $now = now();

            // A Meet & Greet still booked for the request ends with it; the admin is named as ending it.
            if ($target?->activeMeetAndGreet) {
                $meeting = $target->activeMeetAndGreet;
                $meeting->status = MeetAndGreetStatus::Ended->value;
                $meeting->ended_at = $now;
                $meeting->ended_by_user_id = $admin->id;
                $meeting->end_reason = MeetAndGreetEndReason::Other->value;
                $meeting->end_details = $reason;
                $meeting->save();
            }

            if ($target) {
                if ($action === AdoptionAction::ReopenMeetGreetBooking) {
                    $target->status = AdoptionRequestStatus::Approved->value;
                    $target->meet_scheduled_at = null;
                    $target->awaiting_decision_at = null;
                    $target->closed_at = null;
                    // A fresh 14 days to book, as after an approval (§5.3).
                    $target->expires_at = $now->copy()->addDays(AdoptionRequestController::EXPIRY_DAYS);
                } else {
                    $target->status = AdoptionRequestStatus::Closed->value;
                    $target->closed_at = $now;
                    $target->expires_at = null;
                }
                $target->overdue_flagged_at = null;
                $target->save();

                ActivityLogger::log(
                    type: ActivityLogType::StatusChange,
                    action: 'admin_request_status_changed',
                    actor: $admin,
                    subject: $target,
                    before: $change['before']['request_status'],
                    after: $target->getStatus()->value,
                    reason: $reason,
                    userAgent: $userAgent,
                );
            }

            if ($action === AdoptionAction::CancelAdoption) {
                if ($link) {
                    $link->link_removed_at = $now;
                    $link->save();

                    ActivityLogger::log(
                        type: ActivityLogType::Adoption,
                        action: 'adoption_link_removed',
                        actor: $admin,
                        subject: $link,
                        before: $link->homeProfile?->full_name,
                        reason: $reason,
                        userAgent: $userAgent,
                    );
                }

                $locked->status = PetStatus::LookingForAHome;
                $locked->save();
            } elseif ($action === AdoptionAction::ReturnToLookingForAHome) {
                // Looking for a Home again, and the requests On Hold back to Sent with a fresh 14 days (§5.3).
                AdoptionRequestController::releasePetFromInProcess($locked, "Admin resolution: {$reason}");
            } elseif ($action === AdoptionAction::ReopenMeetGreetBooking && $locked->getStatusEnum() !== PetStatus::InProcess) {
                $locked->status = PetStatus::InProcess;
                $locked->save();
            }

            $resolution = new AdoptionResolution;
            $resolution->admin_user_id = $admin->id;
            $resolution->pet_id = $locked->id;
            $resolution->adoption_request_id = $target?->id;
            $resolution->action = $action->value;
            $resolution->reason = $reason;
            $resolution->save();

            ActivityLogger::log(
                type: ActivityLogType::Adoption,
                action: 'admin_adoption_resolved',
                actor: $admin,
                subject: $locked,
                before: $change['before']['pet_status'],
                after: $locked->getStatusEnum()->value,
                reason: "{$action->value}: {$reason}",
                userAgent: $userAgent,
            );

            $this->tellBothSides($locked, $target, $link, $action, $reason, $resolution);

            return ['resolution' => $resolution, 'change' => $change];
        });
    }

    /**
     * Which action applies to what, by the rules in the class comment.
     *
     * @param  Collection<int, AdoptionRequest>  $requests
     * @return array<string, array{available: bool, request_ids: list<int>, why_not: string}>
     */
    private function rules(Pet $pet, Collection $requests, ?Adoption $link): array
    {
        $status = $pet->getStatusEnum();
        $adopted = $status === PetStatus::AdoptedHired || $link !== null;
        $ids = fn (callable $where): array => $requests->filter($where)->pluck('id')->map(fn ($id) => (int) $id)->values()->all();

        $inProcess = $adopted ? [] : $ids(fn (AdoptionRequest $ar) => $ar->isInProcess());
        $closable = $ids(fn (AdoptionRequest $ar) => in_array($ar->getStatus(), self::CLOSABLE, true));
        $reopenable = $adopted ? [] : $ids(fn (AdoptionRequest $ar) => in_array($ar->getStatus(), self::REOPENABLE, true));

        return [
            AdoptionAction::CancelAdoption->value => [
                'available' => $adopted,
                'request_ids' => $link ? [(int) $link->adoption_request_id] : [],
                'why_not' => "{$pet->name} hasn't been adopted, so there is no adoption to cancel.",
            ],
            AdoptionAction::ReturnToLookingForAHome->value => [
                'available' => ! $adopted && ($status === PetStatus::InProcess || $inProcess !== []),
                'request_ids' => $inProcess,
                'why_not' => $adopted
                    ? "{$pet->name} is adopted. Cancel the adoption to return it to Looking for a Home."
                    : "{$pet->name} isn't In Process, so there is no process to end.",
            ],
            AdoptionAction::CloseRequest->value => [
                'available' => $closable !== [],
                'request_ids' => $closable,
                'why_not' => "{$pet->name} has no request that is Sent or On Hold. A request in process is ended by returning the pet to Looking for a Home.",
            ],
            AdoptionAction::ReopenMeetGreetBooking->value => [
                'available' => $reopenable !== [],
                'request_ids' => $reopenable,
                'why_not' => "No request of {$pet->name} is Meet Scheduled or Awaiting Decision, so there is no booking to reopen.",
            ],
        ];
    }

    /**
     * The action checked against the rules, with the request it acts on.
     *
     * @return array{pet: Pet, action: AdoptionAction, target: AdoptionRequest|null, link: Adoption|null, requests_restored: int}
     */
    private function plan(Pet $pet, AdoptionAction $action, ?int $requestId): array
    {
        $requests = $this->requestsOf($pet);
        $link = $this->activeLink($pet);
        $rule = $this->rules($pet, $requests, $link)[$action->value];

        if (! $rule['available']) {
            throw ResolutionRefused::notAvailable($rule['why_not']);
        }

        $target = null;
        if ($rule['request_ids'] !== []) {
            if ($requestId === null && count($rule['request_ids']) > 1) {
                throw ResolutionRefused::chooseRequest();
            }
            $id = $requestId ?? $rule['request_ids'][0];
            if (! in_array($id, $rule['request_ids'], true)) {
                throw ResolutionRefused::wrongRequest($pet);
            }
            $target = $requests->firstWhere('id', $id);
        }

        return [
            'pet' => $pet,
            'action' => $action,
            'target' => $target,
            'link' => $link,
            'requests_restored' => $action === AdoptionAction::ReturnToLookingForAHome
                ? $requests->filter(fn (AdoptionRequest $ar) => $ar->getStatus() === AdoptionRequestStatus::OnHold)->count()
                : 0,
        ];
    }

    /**
     * A plan as the confirmation dialog reads it: each status before and after, and what else moves with it.
     *
     * @param  array{pet: Pet, action: AdoptionAction, target: AdoptionRequest|null, link: Adoption|null, requests_restored: int}  $plan
     * @return array<string, mixed>
     */
    private function describe(array $plan): array
    {
        ['pet' => $pet, 'action' => $action, 'target' => $target, 'link' => $link] = $plan;
        $furparent = $link?->homeProfile?->full_name;
        $petBefore = $pet->getStatusEnum();

        return [
            'pet_id' => $pet->id,
            'pet_name' => $pet->name,
            'action' => $action->value,
            'request' => $target ? ['id' => $target->id, 'home_name' => $target->homeProfile?->full_name] : null,
            'before' => [
                'pet_status' => $petBefore->value,
                'request_status' => $target?->getStatus()->value,
                'furparent_name' => $furparent,
            ],
            'after' => [
                'pet_status' => match ($action) {
                    AdoptionAction::CancelAdoption, AdoptionAction::ReturnToLookingForAHome => PetStatus::LookingForAHome->value,
                    AdoptionAction::ReopenMeetGreetBooking => PetStatus::InProcess->value,
                    AdoptionAction::CloseRequest => $petBefore->value,
                },
                'request_status' => match (true) {
                    $target === null => null,
                    $action === AdoptionAction::ReopenMeetGreetBooking => AdoptionRequestStatus::Approved->value,
                    default => AdoptionRequestStatus::Closed->value,
                },
                'furparent_name' => $action === AdoptionAction::CancelAdoption ? null : $furparent,
            ],
            // What moves with it: the requests On Hold that go back to Sent, and a Meet & Greet still booked.
            'requests_restored' => $plan['requests_restored'],
            'meeting_ended' => $target?->activeMeetAndGreet !== null,
        ];
    }

    /** @return Collection<int, AdoptionRequest> newest first */
    private function requestsOf(Pet $pet): Collection
    {
        return AdoptionRequest::query()
            ->with(['homeProfile.user', 'activeMeetAndGreet'])
            ->where('pet_id', $pet->id)
            ->orderByDesc('id')
            ->get();
    }

    /** The pet's one Furparent link, while it stands (§5.5). */
    private function activeLink(Pet $pet): ?Adoption
    {
        return Adoption::query()->with('homeProfile.user')->where('pet_id', $pet->id)->active()->latest('id')->first();
    }

    /**
     * Both accounts read what changed and the admin's reason, in plain words (AL-08). An admin's correction is not
     * something to opt out of, so notification preferences don't hold it back.
     */
    private function tellBothSides(Pet $pet, ?AdoptionRequest $target, ?Adoption $link, AdoptionAction $action, string $reason, AdoptionResolution $resolution): void
    {
        $home = $target?->homeProfile ?? $link?->homeProfile;
        $homeName = $home?->full_name ?? 'the home';

        [$toPet, $toHuman] = match ($action) {
            AdoptionAction::CancelAdoption => [
                ['Your adoption was cancelled', "An admin cancelled your adoption by {$homeName}. You're Looking for a Home again."],
                ["The adoption of {$pet->name} was cancelled", "An admin cancelled your adoption of {$pet->name}. {$pet->name} is Looking for a Home again."],
            ],
            AdoptionAction::ReturnToLookingForAHome => [
                ["You're Looking for a Home again", $target ? "An admin ended the process with {$homeName} and closed your request." : 'An admin set your status back to Looking for a Home.'],
                ["The request from {$pet->name} was closed", "An admin ended the adoption process with {$pet->name}."],
            ],
            AdoptionAction::CloseRequest => [
                ["Your request to {$homeName} was closed", "An admin closed the request you sent to {$homeName}."],
                ["The request from {$pet->name} was closed", "An admin closed the request {$pet->name} sent you."],
            ],
            AdoptionAction::ReopenMeetGreetBooking => [
                ['Meet & Greet booking is open again', "An admin reopened booking for your request to {$homeName}. Pick a new slot to meet."],
                ["Meet & Greet booking with {$pet->name} is open again", "An admin reopened booking for the request from {$pet->name}. {$pet->name} can pick a new slot."],
            ],
        };

        $send = function (?User $recipient, array $words, string $fallbackUrl) use ($pet, $target, $reason, $resolution): void {
            if (! $recipient) {
                return;
            }
            $url = $target ? "/requests/{$target->id}" : $fallbackUrl;

            $this->notifications->store(
                recipient: $recipient,
                type: NotificationType::AccountAction->value,
                title: $words[0],
                body: "{$words[1]} Reason: {$reason}",
                data: [
                    'category' => $target ? 'Requests' : 'Account',
                    'pet_id' => $pet->id,
                    'adoption_request_id' => $target?->id,
                    'resolution_id' => $resolution->id,
                    'link' => $url,
                ],
                urgency: 'warning',
                actionUrl: $url,
            );
        };

        $send($pet->user, $toPet, '/me');
        $send($home?->user, $toHuman, '/requests');
    }
}
