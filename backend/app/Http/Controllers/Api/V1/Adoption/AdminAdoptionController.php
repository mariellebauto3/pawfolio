<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Adoption;

use App\Enums\ActivityLogType;
use App\Enums\AdoptionAction;
use App\Enums\AdoptionRequestStatus;
use App\Enums\MeetAndGreetEndReason;
use App\Enums\MeetAndGreetStatus;
use App\Enums\NotificationType;
use App\Enums\PetStatus;
use App\Http\Controllers\Api\V1\AdoptionRequests\AdoptionRequestController;
use App\Http\Controllers\Controller;
use App\Http\Resources\AdoptionRequests\AdoptionRequestResource;
use App\Http\Resources\ErrorResource;
use App\Http\Resources\PaginatedResource;
use App\Http\Resources\Profiles\HomeProfileResource;
use App\Http\Resources\Profiles\PetResource;
use App\Http\Resources\ResponseResource;
use App\Models\Adoption;
use App\Models\AdoptionRequest;
use App\Models\AdoptionResolution;
use App\Models\MeetAndGreet;
use App\Models\Pet;
use App\Services\ActivityLogs\ActivityLogger;
use App\Services\Matching\MatchScoreCalculator;
use App\Services\Notifications\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Admin adoption monitor, Meet & Greets list, overdue requests, manual adoption resolution, and alumni list (BE-20, RQ-18..RQ-19, MG-15..MG-16, AL-07..AL-09).
 */
class AdminAdoptionController extends Controller
{
    public function __construct(
        private readonly NotificationService $notifications,
        private readonly MatchScoreCalculator $matcher,
    ) {}

    public function requestsIndex(Request $request)
    {
        $perPage = min(max((int) $request->query('per_page', 20), 1), 50);

        $query = AdoptionRequest::query()
            ->with(['pet.photos', 'homeProfile', 'activeMeetAndGreet.slot', 'latestMeetAndGreet.slot'])
            ->orderByDesc('sent_at')
            ->orderByDesc('id');

        if ($request->filled('tab')) {
            $tab = strtolower(trim($request->string('tab')->toString()));
            if ($tab === 'overdue') {
                $query->where('status', AdoptionRequestStatus::AwaitingDecision->value)
                    ->where(function ($sub): void {
                        $sub->whereNotNull('overdue_flagged_at')
                            ->orWhere('awaiting_decision_at', '<=', now()->subDays(7));
                    });
            } elseif (in_array($tab, ['meet_and_greets', 'meet & greets', 'meet-and-greets'], true)) {
                $query->whereHas('meetAndGreets');
            }
        }

        if ($request->filled('status')) {
            $statuses = array_values(array_filter(explode(',', $request->string('status')->toString())));
            if ($statuses !== []) {
                $query->whereIn('status', $statuses);
            }
        }

        if ($request->filled('q')) {
            $term = trim($request->string('q')->toString());
            if ($term !== '') {
                $like = '%'.addcslashes($term, '%_\\').'%';
                $query->where(function ($sub) use ($like): void {
                    $sub->whereHas('pet', fn ($p) => $p->where('name', 'like', $like))
                        ->orWhereHas('homeProfile', fn ($h) => $h->where('full_name', 'like', $like));
                });
            }
        }

        $paginator = $query->paginate($perPage);

        return PaginatedResource::fromPaginator($paginator, function (AdoptionRequest $ar) use ($request): array {
            $item = (new AdoptionRequestResource($ar))->toArray($request);
            $item['is_overdue'] = $ar->overdue_flagged_at !== null
                || ($ar->getStatus() === AdoptionRequestStatus::AwaitingDecision && $ar->awaiting_decision_at && $ar->awaiting_decision_at->lte(now()->subDays(7)));
            $item['latest_meet_and_greet'] = $ar->latestMeetAndGreet
                ? AdoptionRequestResource::formatMeetAndGreet($ar->latestMeetAndGreet)
                : null;

            return $item;
        });
    }

    public function requestShow(Request $request, AdoptionRequest $adoptionRequest)
    {
        $adoptionRequest->load(['pet.photos', 'pet.user', 'homeProfile.user', 'activeMeetAndGreet.slot', 'latestMeetAndGreet.slot', 'adoption']);

        // RQ-19 / SEC-PRIV-04: Thread messages stay private unless attached to a report.
        $data = (new AdoptionRequestResource($adoptionRequest))
            ->withDetails()
            ->withPrivateMessages(false)
            ->toArray($request);

        $data['parties'] = [
            'pet_user_id' => $adoptionRequest->pet?->user_id,
            'pet_email' => $adoptionRequest->pet?->user?->email,
            'human_user_id' => $adoptionRequest->homeProfile?->user_id,
            'human_email' => $adoptionRequest->homeProfile?->user?->email,
        ];

        return ResponseResource::make($data);
    }

    public function sendReminder(Request $request, AdoptionRequest $adoptionRequest)
    {
        $admin = $request->user();
        $adoptionRequest->load(['pet.user', 'homeProfile.user']);

        $status = $adoptionRequest->getStatus();
        $recipient = match ($status) {
            AdoptionRequestStatus::Sent,
            AdoptionRequestStatus::MeetScheduled,
            AdoptionRequestStatus::AwaitingDecision => $adoptionRequest->homeProfile?->user,
            AdoptionRequestStatus::Approved => $adoptionRequest->pet?->user,
            default => null,
        };

        if (! $recipient) {
            return ErrorResource::conflict('No reminder is needed for this request status.', 'no_reminder_needed')->toResponse($request);
        }

        $this->notifications->store(
            recipient: $recipient,
            type: NotificationType::RequestUnderReview->value,
            title: "Reminder: Action needed on adoption request #{$adoptionRequest->id}",
            body: "Please review and update the status of adoption request #{$adoptionRequest->id} for {$adoptionRequest->pet?->name}.",
            data: [
                'category' => 'Requests',
                'adoption_request_id' => $adoptionRequest->id,
                'link' => "/requests/{$adoptionRequest->id}",
            ],
            urgency: 'warning',
            actionUrl: "/requests/{$adoptionRequest->id}",
        );

        ActivityLogger::log(
            type: ActivityLogType::Request,
            action: 'admin_request_reminder_sent',
            actor: $admin,
            subject: $adoptionRequest,
            userAgent: $request->userAgent(),
        );

        return ResponseResource::make(['reminded' => true]);
    }

    public function meetAndGreetsIndex(Request $request)
    {
        $perPage = min(max((int) $request->query('per_page', 20), 1), 50);

        $query = MeetAndGreet::query()
            ->with(['slot', 'proposedSlot', 'request.pet.photos', 'request.homeProfile'])
            ->orderByDesc('booked_at')
            ->orderByDesc('id');

        if ($request->filled('status')) {
            $statuses = array_values(array_filter(explode(',', $request->string('status')->toString())));
            if ($statuses !== []) {
                $query->whereIn('status', $statuses);
            }
        }

        $paginator = $query->paginate($perPage);

        return PaginatedResource::fromPaginator($paginator, function (MeetAndGreet $mg): array {
            $formatted = AdoptionRequestResource::formatMeetAndGreet($mg);
            $formatted['pet'] = $mg->request?->pet ? PetResource::summary($mg->request->pet) : null;
            $formatted['home_profile'] = $mg->request?->homeProfile ? HomeProfileResource::summary($mg->request->homeProfile) : null;
            $formatted['request_status'] = $mg->request?->getStatus()->value;

            return $formatted;
        });
    }

    public function resolvePreview(Request $request, Pet $pet)
    {
        $validated = $request->validate([
            'action' => ['required', 'string', Rule::in(array_map(fn ($c) => $c->value, AdoptionAction::cases()))],
            'adoption_request_id' => ['nullable', 'integer'],
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        $action = AdoptionAction::from($validated['action']);
        $pet->loadMissing(['publishedAdoption.homeProfile', 'adoptionRequests']);

        $targetRequest = ! empty($validated['adoption_request_id'])
            ? AdoptionRequest::query()->where('pet_id', $pet->id)->find((int) $validated['adoption_request_id'])
            : $pet->adoptionRequests()->latest('id')->first();

        $afterPetStatus = match ($action) {
            AdoptionAction::CancelAdoption,
            AdoptionAction::ReturnToLookingForAHome,
            AdoptionAction::CloseRequest => PetStatus::LookingForAHome->value,
            AdoptionAction::ReopenMeetGreetBooking => PetStatus::InProcess->value,
        };

        $afterRequestStatus = match ($action) {
            AdoptionAction::CancelAdoption,
            AdoptionAction::ReturnToLookingForAHome,
            AdoptionAction::CloseRequest => AdoptionRequestStatus::Closed->value,
            AdoptionAction::ReopenMeetGreetBooking => AdoptionRequestStatus::Approved->value,
        };

        return ResponseResource::make([
            'pet_id' => $pet->id,
            'pet_name' => $pet->name,
            'action' => $action->value,
            'before' => [
                'pet_status' => $pet->getStatusEnum()->value,
                'request_id' => $targetRequest?->id,
                'request_status' => $targetRequest?->getStatus()->value,
                'furparent_link' => $pet->publishedAdoption?->homeProfile?->full_name,
            ],
            'after' => [
                'pet_status' => $afterPetStatus,
                'request_id' => $targetRequest?->id,
                'request_status' => $targetRequest ? $afterRequestStatus : null,
                'furparent_link' => in_array($action, [AdoptionAction::CancelAdoption, AdoptionAction::ReturnToLookingForAHome], true)
                    ? null
                    : $pet->publishedAdoption?->homeProfile?->full_name,
            ],
            'reason' => $validated['reason'] ?? null,
        ]);
    }

    public function resolve(Request $request, Pet $pet)
    {
        $admin = $request->user();

        $validated = $request->validate([
            'action' => ['required', 'string', Rule::in(array_map(fn ($c) => $c->value, AdoptionAction::cases()))],
            'reason' => ['required', 'string', 'max:1000'],
            'adoption_request_id' => ['nullable', 'integer'],
        ], [
            'reason.required' => 'Enter a reason for this resolution.',
        ]);

        $action = AdoptionAction::from($validated['action']);
        $reason = trim($validated['reason']);

        $resolution = DB::transaction(function () use ($pet, $admin, $action, $reason, $validated, $request): AdoptionResolution {
            /** @var Pet $lockedPet */
            $lockedPet = Pet::query()
                ->with(['user', 'publishedAdoption.homeProfile.user', 'adoptionRequests.homeProfile.user'])
                ->whereKey($pet->id)
                ->lockForUpdate()
                ->firstOrFail();

            $targetRequest = ! empty($validated['adoption_request_id'])
                ? AdoptionRequest::query()->with(['homeProfile.user', 'activeMeetAndGreet'])->where('pet_id', $lockedPet->id)->find((int) $validated['adoption_request_id'])
                : $lockedPet->adoptionRequests()->with(['homeProfile.user', 'activeMeetAndGreet'])->latest('id')->first();

            $beforePetStatus = $lockedPet->getStatusEnum()->value;
            $beforeReqStatus = $targetRequest?->getStatus()->value;

            if (in_array($action, [AdoptionAction::CancelAdoption, AdoptionAction::ReturnToLookingForAHome], true)) {
                $activeAdoption = Adoption::query()
                    ->where('pet_id', $lockedPet->id)
                    ->whereNull('link_removed_at')
                    ->first();

                if ($activeAdoption) {
                    $activeAdoption->link_removed_at = now();
                    $activeAdoption->save();
                }

                if ($targetRequest && ! $targetRequest->isClosed()) {
                    $targetRequest->status = AdoptionRequestStatus::Closed->value;
                    $targetRequest->closed_at = now();
                    $targetRequest->expires_at = null;
                    $targetRequest->save();
                } elseif ($targetRequest && $targetRequest->getStatus() === AdoptionRequestStatus::Adopted) {
                    $targetRequest->status = AdoptionRequestStatus::Closed->value;
                    $targetRequest->closed_at = now();
                    $targetRequest->save();
                }

                $lockedPet->status = PetStatus::LookingForAHome;
                $lockedPet->save();
            } elseif ($action === AdoptionAction::CloseRequest) {
                if ($targetRequest) {
                    if ($targetRequest->activeMeetAndGreet) {
                        $mg = $targetRequest->activeMeetAndGreet;
                        $mg->status = MeetAndGreetStatus::Ended->value;
                        $mg->ended_at = now();
                        $mg->ended_by_user_id = $admin->id;
                        $mg->end_reason = MeetAndGreetEndReason::Other->value;
                        $mg->end_details = $reason;
                        $mg->save();
                    }

                    $targetRequest->status = AdoptionRequestStatus::Closed->value;
                    $targetRequest->closed_at = now();
                    $targetRequest->expires_at = null;
                    $targetRequest->save();
                }

                AdoptionRequestController::releasePetFromInProcess($lockedPet, "Admin resolution ({$action->value}): {$reason}");
            } elseif ($action === AdoptionAction::ReopenMeetGreetBooking) {
                if ($targetRequest) {
                    if ($targetRequest->activeMeetAndGreet) {
                        $mg = $targetRequest->activeMeetAndGreet;
                        $mg->status = MeetAndGreetStatus::Ended->value;
                        $mg->ended_at = now();
                        $mg->ended_by_user_id = $admin->id;
                        $mg->end_reason = MeetAndGreetEndReason::Other->value;
                        $mg->end_details = $reason;
                        $mg->save();
                    }

                    $targetRequest->status = AdoptionRequestStatus::Approved->value;
                    $targetRequest->meet_scheduled_at = null;
                    $targetRequest->awaiting_decision_at = null;
                    $targetRequest->overdue_flagged_at = null;
                    $targetRequest->closed_at = null;
                    $targetRequest->expires_at = now()->addDays(14);
                    $targetRequest->save();
                }

                $lockedPet->status = PetStatus::InProcess;
                $lockedPet->save();
            }

            $res = new AdoptionResolution;
            $res->admin_user_id = $admin->id;
            $res->pet_id = $lockedPet->id;
            $res->adoption_request_id = $targetRequest?->id;
            $res->action = $action->value;
            $res->reason = $reason;
            $res->save();

            ActivityLogger::log(
                type: ActivityLogType::Adoption,
                action: 'admin_adoption_resolved',
                actor: $admin,
                subject: $lockedPet,
                before: $beforePetStatus,
                after: $lockedPet->getStatusEnum()->value,
                reason: "{$action->value}: {$reason}",
                userAgent: $request->userAgent(),
            );

            if ($targetRequest && $beforeReqStatus !== $targetRequest->getStatus()->value) {
                ActivityLogger::log(
                    type: ActivityLogType::StatusChange,
                    action: 'admin_request_status_changed',
                    actor: $admin,
                    subject: $targetRequest,
                    before: $beforeReqStatus,
                    after: $targetRequest->getStatus()->value,
                    reason: $reason,
                    userAgent: $request->userAgent(),
                );
            }

            // Notify both accounts (AL-08).
            if ($lockedPet->user) {
                $this->notifications->store(
                    recipient: $lockedPet->user,
                    type: NotificationType::AccountAction->value,
                    title: "Admin update for {$lockedPet->name}",
                    body: "An administrator updated {$lockedPet->name}'s adoption status ({$action->value}). Reason: {$reason}",
                    data: [
                        'category' => 'Account',
                        'pet_id' => $lockedPet->id,
                        'resolution_id' => $res->id,
                        'link' => '/me',
                    ],
                    urgency: 'warning',
                    actionUrl: '/me',
                );
            }

            $humanUser = $targetRequest?->homeProfile?->user ?? $lockedPet->publishedAdoption?->homeProfile?->user;
            if ($humanUser) {
                $this->notifications->store(
                    recipient: $humanUser,
                    type: NotificationType::AccountAction->value,
                    title: "Admin update on adoption record for {$lockedPet->name}",
                    body: "An administrator updated the adoption status for {$lockedPet->name} ({$action->value}). Reason: {$reason}",
                    data: [
                        'category' => 'Account',
                        'pet_id' => $lockedPet->id,
                        'resolution_id' => $res->id,
                        'link' => '/requests',
                    ],
                    urgency: 'warning',
                    actionUrl: '/requests',
                );
            }

            return $res;
        });

        $pet->refresh();
        $this->matcher->recalculateForPet($pet);

        return ResponseResource::make([
            'id' => $resolution->id,
            'pet_id' => $pet->id,
            'pet_status' => $pet->getStatusEnum()->value,
            'adoption_request_id' => $resolution->adoption_request_id,
            'action' => $resolution->action,
            'reason' => $resolution->reason,
            'created_at' => $resolution->created_at?->toISOString(),
        ]);
    }

    public function alumniIndex(Request $request)
    {
        $perPage = min(max((int) $request->query('per_page', 20), 1), 50);

        $query = Adoption::query()
            ->with(['pet.photos', 'homeProfile', 'request'])
            ->orderByDesc('adopted_at')
            ->orderByDesc('id');

        if (! $request->boolean('include_removed')) {
            $query->whereNull('link_removed_at');
        }

        $paginator = $query->paginate($perPage);

        return PaginatedResource::fromPaginator($paginator, function (Adoption $adoption): array {
            return [
                'id' => $adoption->id,
                'adopted_at' => $adoption->adopted_at?->toISOString(),
                'link_removed_at' => $adoption->link_removed_at?->toISOString(),
                'adoption_request_id' => $adoption->adoption_request_id,
                'pet' => $adoption->pet ? PetResource::summary($adoption->pet) : null,
                'home_profile' => $adoption->homeProfile ? HomeProfileResource::summary($adoption->homeProfile) : null,
            ];
        });
    }
}
