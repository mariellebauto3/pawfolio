<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\AdoptionRequests;

use App\Enums\AccountStatus;
use App\Enums\ActivityLogType;
use App\Enums\AdoptionRequestDeclineReason;
use App\Enums\AdoptionRequestStatus;
use App\Enums\AdoptionRequestWithdrawReason;
use App\Enums\MeetAndGreetEndReason;
use App\Enums\MeetAndGreetStatus;
use App\Enums\NotificationType;
use App\Enums\PetStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\AdoptionRequests\AdoptionRequestResource;
use App\Http\Resources\ErrorResource;
use App\Http\Resources\ResponseResource;
use App\Models\AdoptionRequest;
use App\Models\HomeProfile;
use App\Models\Pet;
use App\Models\RequestMessage;
use App\Models\User;
use App\Services\ActivityLogs\ActivityLogger;
use App\Services\Notifications\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Adoption request lifecycle: send, list, detail, approve, decline, withdraw, and request thread messages (BE-16, RQ-03..RQ-17).
 */
class AdoptionRequestController extends Controller
{
    public const MAX_OPEN_REQUESTS = 3;

    public const COOLDOWN_DAYS = 30;

    public const EXPIRY_DAYS = 14;

    public function __construct(
        private readonly NotificationService $notifications,
    ) {}

    public function index(Request $request)
    {
        $user = $request->user();
        $perPage = min(max((int) $request->query('per_page', 20), 1), 50);

        $query = AdoptionRequest::query()
            ->with(['pet.photos', 'homeProfile'])
            ->orderByDesc('sent_at')
            ->orderByDesc('id');

        if ($user->isPet()) {
            $petId = $user->pet?->id ?? 0;
            $query->where('pet_id', $petId);
        } elseif ($user->isHuman()) {
            $homeId = $user->homeProfile?->id ?? 0;
            $query->where('home_profile_id', $homeId);
        } elseif (! $user->isAdmin()) {
            return ErrorResource::forbidden()->toResponse($request);
        }

        if ($request->filled('status')) {
            $statuses = array_values(array_filter(explode(',', $request->string('status')->toString())));
            if ($statuses !== []) {
                $query->whereIn('status', $statuses);
            }
        } elseif ($request->filled('tab')) {
            $tab = strtolower(trim($request->string('tab')->toString()));
            match ($tab) {
                'active', 'open' => $query->whereIn('status', AdoptionRequest::OPEN_STATUSES),
                'new' => $query->where('status', AdoptionRequestStatus::Sent->value),
                'in_progress', 'in progress', 'in-progress' => $query->whereIn('status', AdoptionRequest::IN_PROCESS_STATUSES),
                'closed' => $query->whereIn('status', AdoptionRequest::CLOSED_STATUSES),
                default => null,
            };
        }

        $paginator = $query->paginate($perPage);

        $items = $paginator->getCollection()
            ->map(fn (AdoptionRequest $ar) => (new AdoptionRequestResource($ar))->toArray($request))
            ->values()
            ->all();

        return ResponseResource::paginated($paginator, $items);
    }

    public function show(Request $request, int $adoptionRequest)
    {
        $user = $request->user();
        $ar = AdoptionRequest::query()
            ->with(['pet.photos', 'homeProfile', 'activeMeetAndGreet.slot', 'latestMeetAndGreet.slot'])
            ->find($adoptionRequest);

        // SEC-AUTHZ-03 / SEC-AUTHZ-04: Return 404 for someone else's request so IDs cannot be probed.
        if (! $ar || ! $this->canView($ar, $user)) {
            return ErrorResource::notFound("We couldn't find that request.")->toResponse($request);
        }

        // Thread messages stay private to the two parties (RQ-19, SEC-PRIV-04).
        $isParty = ($user->isPet() && $user->pet?->id === $ar->pet_id)
            || ($user->isHuman() && $user->homeProfile?->id === $ar->home_profile_id);

        return ResponseResource::make(
            (new AdoptionRequestResource($ar))
                ->withDetails()
                ->withPrivateMessages($isParty)
                ->toArray($request),
        );
    }

    public function storeForHome(Request $request, HomeProfile $home)
    {
        $request->merge(['home_profile_id' => $home->id]);

        return $this->store($request);
    }

    public function store(Request $request)
    {
        $user = $request->user();

        if (! $user->isPet() || ! $user->pet) {
            return ErrorResource::forbidden('Only pets can send adoption requests.')->toResponse($request);
        }

        $validated = $request->validate([
            'home_profile_id' => ['required', 'integer', 'exists:home_profiles,id'],
            'cover_letter' => ['required', 'string', 'min:50', 'max:600'],
            'caretaker_notes' => ['nullable', 'string', 'max:600'],
        ], [
            'home_profile_id.required' => 'Choose a home to apply to.',
            'home_profile_id.exists' => 'Choose a home to apply to.',
            'cover_letter.required' => 'Write between 50 and 600 characters.',
            'cover_letter.min' => 'Write between 50 and 600 characters.',
            'cover_letter.max' => 'Write between 50 and 600 characters.',
        ]);

        /** @var HomeProfile|null $home */
        $home = HomeProfile::query()->with('user')->find((int) $validated['home_profile_id']);
        if (! $home || ! $home->user || $home->user->getStatus() !== AccountStatus::Active) {
            return ErrorResource::notFound("We couldn't find that Home Profile.")->toResponse($request);
        }

        return DB::transaction(function () use ($user, $home, $validated, $request) {
            /** @var Pet $pet */
            $pet = Pet::query()->whereKey($user->pet->id)->lockForUpdate()->firstOrFail();

            if ($pet->getStatusEnum() === PetStatus::Draft) {
                return ErrorResource::conflict(
                    'Publish your Pet Résumé before sending adoption requests.',
                    'pet_resume_draft',
                )->toResponse($request);
            }

            if ($pet->getStatusEnum() === PetStatus::AdoptedHired) {
                return ErrorResource::conflict(
                    'An adopted pet cannot send adoption requests.',
                    'already_adopted',
                )->toResponse($request);
            }

            if ($pet->getStatusEnum() === PetStatus::InProcess) {
                return ErrorResource::conflict(
                    'Your pet already has an adoption request in process.',
                    'pet_in_process',
                )->toResponse($request);
            }

            $openRequests = AdoptionRequest::query()
                ->where('pet_id', $pet->id)
                ->open()
                ->lockForUpdate()
                ->get();

            if ($openRequests->contains(fn (AdoptionRequest $r) => $r->home_profile_id === $home->id)) {
                return ErrorResource::conflict(
                    "You already have an open request with {$home->full_name}.",
                    'request_already_open',
                )->toResponse($request);
            }

            // 30-day cooldown after a decline or not_adopted with the same Home Profile (RQ-06).
            $recentDecline = AdoptionRequest::query()
                ->where('pet_id', $pet->id)
                ->where('home_profile_id', $home->id)
                ->whereIn('status', [
                    AdoptionRequestStatus::Declined->value,
                    AdoptionRequestStatus::NotAdopted->value,
                ])
                ->whereNotNull('closed_at')
                ->where('closed_at', '>', now()->subDays(self::COOLDOWN_DAYS))
                ->orderByDesc('closed_at')
                ->first();

            if ($recentDecline !== null) {
                $cooldownEnd = $recentDecline->closed_at->copy()->addDays(self::COOLDOWN_DAYS)->format('M j, Y');

                return ErrorResource::conflict(
                    "You can apply to {$home->full_name} again after {$cooldownEnd} (30-day cooldown).",
                    'request_cooldown',
                )->toResponse($request);
            }

            if ($openRequests->count() >= self::MAX_OPEN_REQUESTS) {
                return ErrorResource::conflict(
                    'You already have '.self::MAX_OPEN_REQUESTS.' open requests. Wait for an answer or withdraw one first.',
                    'open_request_limit',
                )->toResponse($request);
            }

            if ($openRequests->contains(fn (AdoptionRequest $r) => $r->isInProcess())) {
                return ErrorResource::conflict(
                    'Your pet already has an adoption request in process.',
                    'pet_in_process',
                )->toResponse($request);
            }

            if (! $home->is_open_to_adopt) {
                return ErrorResource::conflict(
                    "{$home->full_name} isn't open to adopt right now.",
                    'not_open_to_adopt',
                )->toResponse($request);
            }

            $now = now();
            $ar = new AdoptionRequest;
            $ar->pet_id = $pet->id;
            $ar->home_profile_id = $home->id;
            $ar->status = AdoptionRequestStatus::Sent->value;
            $ar->cover_letter = trim($validated['cover_letter']);
            $ar->caretaker_notes = isset($validated['caretaker_notes']) && trim($validated['caretaker_notes']) !== ''
                ? trim($validated['caretaker_notes'])
                : null;
            $ar->sent_at = $now;
            $ar->expires_at = $now->copy()->addDays(self::EXPIRY_DAYS);
            $ar->save();

            $this->notifyParty(
                recipient: $home->user,
                type: NotificationType::RequestReceived->value,
                title: "New adoption request from {$pet->name}",
                body: "{$pet->name} sent an adoption request with a cover letter and résumé.",
                ar: $ar,
            );

            ActivityLogger::log(
                type: ActivityLogType::Request,
                action: 'adoption_request_sent',
                actor: $user,
                subject: $ar,
                before: null,
                after: AdoptionRequestStatus::Sent->value,
                userAgent: $request->userAgent(),
            );

            return ResponseResource::created(
                (new AdoptionRequestResource($ar->load(['pet.photos', 'homeProfile'])))->toArray($request),
            )->toResponse($request);
        });
    }

    public function approve(Request $request, AdoptionRequest $adoptionRequest)
    {
        $user = $request->user();

        if (! $user->isHuman() || ! $user->homeProfile || $adoptionRequest->home_profile_id !== $user->homeProfile->id) {
            return ErrorResource::forbidden('Only the recipient Home Profile can approve this request.')->toResponse($request);
        }

        $validated = $request->validate([
            'approval_message' => ['nullable', 'string', 'max:600'],
        ]);

        return DB::transaction(function () use ($adoptionRequest, $user, $validated, $request) {
            /** @var AdoptionRequest $ar */
            $ar = AdoptionRequest::query()
                ->with(['pet.user', 'homeProfile'])
                ->whereKey($adoptionRequest->id)
                ->lockForUpdate()
                ->firstOrFail();

            /** @var Pet $pet */
            $pet = Pet::query()->whereKey($ar->pet_id)->lockForUpdate()->firstOrFail();

            if ($ar->getStatus() !== AdoptionRequestStatus::Sent) {
                return ErrorResource::conflict(
                    'Only a Sent adoption request can be approved.',
                    'invalid_request_state',
                )->toResponse($request);
            }

            if ($ar->expires_at && $ar->expires_at->isPast()) {
                return ErrorResource::conflict(
                    'This adoption request has expired.',
                    'request_expired',
                )->toResponse($request);
            }

            if ($pet->getStatusEnum() !== PetStatus::LookingForAHome) {
                return ErrorResource::conflict(
                    'This pet is already in an adoption process or has been adopted.',
                    'pet_unavailable',
                )->toResponse($request);
            }

            $now = now();
            $beforeStatus = $ar->getStatus()->value;
            $ar->status = AdoptionRequestStatus::Approved->value;
            $ar->approval_message = isset($validated['approval_message']) && trim($validated['approval_message']) !== ''
                ? trim($validated['approval_message'])
                : null;
            $ar->approved_at = $now;
            $ar->expires_at = $now->copy()->addDays(self::EXPIRY_DAYS);
            $ar->save();

            $petBefore = $pet->getStatusEnum()->value;
            $pet->status = PetStatus::InProcess;
            $pet->save();

            ActivityLogger::log(
                type: ActivityLogType::StatusChange,
                action: 'pet_status_in_process',
                actor: null,
                subject: $pet,
                before: $petBefore,
                after: PetStatus::InProcess->value,
                reason: "Request #{$ar->id} approved",
                userAgent: $request->userAgent(),
            );

            // Put the pet's other Sent requests On Hold (RQ-12, RQ-15).
            $otherSentRequests = AdoptionRequest::query()
                ->with('homeProfile.user')
                ->where('pet_id', $pet->id)
                ->where('id', '!=', $ar->id)
                ->where('status', AdoptionRequestStatus::Sent->value)
                ->lockForUpdate()
                ->get();

            foreach ($otherSentRequests as $other) {
                $other->status = AdoptionRequestStatus::OnHold->value;
                $other->expires_at = null;
                $other->save();

                if ($other->homeProfile?->user) {
                    $this->notifyParty(
                        recipient: $other->homeProfile->user,
                        type: NotificationType::RequestUnderReview->value,
                        title: "{$pet->name}'s request is temporarily On Hold",
                        body: "{$pet->name} is currently in the Meet & Greet stage with another home.",
                        ar: $other,
                    );
                }
            }

            if ($pet->user) {
                $this->notifyParty(
                    recipient: $pet->user,
                    type: NotificationType::RequestApproved->value,
                    title: "{$ar->homeProfile->full_name} approved {$pet->name}'s request!",
                    body: 'Book a Meet & Greet slot within 14 days and message each other in the request thread.',
                    ar: $ar,
                );
            }

            ActivityLogger::log(
                type: ActivityLogType::Request,
                action: 'adoption_request_approved',
                actor: $user,
                subject: $ar,
                before: $beforeStatus,
                after: AdoptionRequestStatus::Approved->value,
                userAgent: $request->userAgent(),
            );

            return ResponseResource::make(
                (new AdoptionRequestResource($ar->fresh(['pet.photos', 'homeProfile'])))
                    ->withDetails()
                    ->toArray($request),
            )->toResponse($request);
        });
    }

    public function decline(Request $request, AdoptionRequest $adoptionRequest)
    {
        $user = $request->user();

        if (! $user->isHuman() || ! $user->homeProfile || $adoptionRequest->home_profile_id !== $user->homeProfile->id) {
            return ErrorResource::forbidden('Only the recipient Home Profile can decline this request.')->toResponse($request);
        }

        $validated = $request->validate([
            'decline_reason' => ['nullable', 'string', Rule::in(array_map(fn ($c) => $c->value, AdoptionRequestDeclineReason::cases()))],
            'decision_message' => ['nullable', 'string', 'max:600'],
        ]);

        return DB::transaction(function () use ($adoptionRequest, $user, $validated, $request) {
            /** @var AdoptionRequest $ar */
            $ar = AdoptionRequest::query()
                ->with(['pet.user', 'homeProfile'])
                ->whereKey($adoptionRequest->id)
                ->lockForUpdate()
                ->firstOrFail();

            if (! in_array($ar->getStatus(), [
                AdoptionRequestStatus::Sent,
                AdoptionRequestStatus::OnHold,
                AdoptionRequestStatus::Approved,
            ], true)) {
                return ErrorResource::conflict(
                    'This request cannot be declined at its current stage.',
                    'invalid_request_state',
                )->toResponse($request);
            }

            $wasInProcess = $ar->isInProcess();
            $beforeStatus = $ar->getStatus()->value;

            $ar->status = AdoptionRequestStatus::Declined->value;
            $ar->decline_reason = $validated['decline_reason'] ?? null;
            $ar->decision_message = isset($validated['decision_message']) && trim($validated['decision_message']) !== ''
                ? trim($validated['decision_message'])
                : null;
            $ar->closed_at = now();
            $ar->expires_at = null;
            $ar->save();

            if ($wasInProcess && $ar->pet) {
                $this->releasePetFromInProcess($ar->pet, "Request #{$ar->id} declined");
            }

            if ($ar->pet?->user) {
                $this->notifyParty(
                    recipient: $ar->pet->user,
                    type: NotificationType::RequestDeclined->value,
                    title: "Update on {$ar->pet->name}'s request to {$ar->homeProfile->full_name}",
                    body: "{$ar->homeProfile->full_name} declined the adoption request.",
                    ar: $ar,
                );
            }

            ActivityLogger::log(
                type: ActivityLogType::Request,
                action: 'adoption_request_declined',
                actor: $user,
                subject: $ar,
                before: $beforeStatus,
                after: AdoptionRequestStatus::Declined->value,
                reason: $ar->decline_reason,
                userAgent: $request->userAgent(),
            );

            return ResponseResource::make(
                (new AdoptionRequestResource($ar->fresh(['pet.photos', 'homeProfile'])))
                    ->withDetails()
                    ->toArray($request),
            )->toResponse($request);
        });
    }

    public function withdraw(Request $request, AdoptionRequest $adoptionRequest)
    {
        $user = $request->user();

        if (! $user->isPet() || ! $user->pet || $adoptionRequest->pet_id !== $user->pet->id) {
            return ErrorResource::forbidden('Only the pet owner who sent this request can withdraw it.')->toResponse($request);
        }

        $validated = $request->validate([
            'withdraw_reason' => ['nullable', 'string', Rule::in(array_map(fn ($c) => $c->value, AdoptionRequestWithdrawReason::cases()))],
        ]);

        return DB::transaction(function () use ($adoptionRequest, $user, $validated, $request) {
            /** @var AdoptionRequest $ar */
            $ar = AdoptionRequest::query()
                ->with(['pet', 'homeProfile.user', 'activeMeetAndGreet'])
                ->whereKey($adoptionRequest->id)
                ->lockForUpdate()
                ->firstOrFail();

            if (! $ar->isOpen()) {
                return ErrorResource::conflict(
                    'Only an open adoption request can be withdrawn.',
                    'request_already_closed',
                )->toResponse($request);
            }

            $wasInProcess = $ar->isInProcess();
            $beforeStatus = $ar->getStatus()->value;

            if ($ar->activeMeetAndGreet) {
                $mg = $ar->activeMeetAndGreet;
                $mg->status = MeetAndGreetStatus::Ended->value;
                $mg->ended_at = now();
                $mg->ended_by_user_id = $user->id;
                $mg->end_reason = MeetAndGreetEndReason::Other->value;
                $mg->end_details = 'Adoption request withdrawn';
                $mg->save();
            }

            $ar->status = AdoptionRequestStatus::Withdrawn->value;
            $ar->withdraw_reason = $validated['withdraw_reason'] ?? null;
            $ar->closed_at = now();
            $ar->expires_at = null;
            $ar->save();

            if ($wasInProcess && $ar->pet) {
                $this->releasePetFromInProcess($ar->pet, "Request #{$ar->id} withdrawn");
            }

            if ($ar->homeProfile?->user) {
                $this->notifyParty(
                    recipient: $ar->homeProfile->user,
                    type: NotificationType::RequestDeclined->value,
                    title: "{$ar->pet->name} withdrew their adoption request",
                    body: "The adoption request from {$ar->pet->name} has been withdrawn.",
                    ar: $ar,
                );
            }

            ActivityLogger::log(
                type: ActivityLogType::Request,
                action: 'adoption_request_withdrawn',
                actor: $user,
                subject: $ar,
                before: $beforeStatus,
                after: AdoptionRequestStatus::Withdrawn->value,
                reason: $ar->withdraw_reason,
                userAgent: $request->userAgent(),
            );

            return ResponseResource::make(
                (new AdoptionRequestResource($ar->fresh(['pet.photos', 'homeProfile'])))
                    ->withDetails()
                    ->toArray($request),
            )->toResponse($request);
        });
    }

    public function messages(Request $request, AdoptionRequest $adoptionRequest)
    {
        $user = $request->user();
        $isParty = ($user->isPet() && $user->pet?->id === $adoptionRequest->pet_id)
            || ($user->isHuman() && $user->homeProfile?->id === $adoptionRequest->home_profile_id);

        if (! $isParty) {
            return ErrorResource::notFound("We couldn't find that request.")->toResponse($request);
        }

        $items = $adoptionRequest->messages()
            ->with('sender')
            ->orderBy('created_at')
            ->get()
            ->map(fn (RequestMessage $msg) => [
                'id' => $msg->id,
                'sender_user_id' => $msg->sender_user_id,
                'sender_name' => $msg->sender?->displayName(),
                'sender_role' => $msg->sender?->getRole()->value,
                'body' => $msg->body,
                'created_at' => $msg->created_at?->toISOString(),
            ])
            ->values()
            ->all();

        return ResponseResource::collection($items);
    }

    public function sendMessage(Request $request, AdoptionRequest $adoptionRequest)
    {
        $user = $request->user();
        $isParty = ($user->isPet() && $user->pet?->id === $adoptionRequest->pet_id)
            || ($user->isHuman() && $user->homeProfile?->id === $adoptionRequest->home_profile_id);

        if (! $isParty) {
            return ErrorResource::notFound("We couldn't find that request.")->toResponse($request);
        }

        if (! $adoptionRequest->isInProcess()) {
            return ErrorResource::conflict(
                'The message thread is only open while the adoption request is in progress.',
                'thread_locked',
            )->toResponse($request);
        }

        $validated = $request->validate([
            'body' => ['required', 'string', 'max:2000'],
        ]);

        $msg = new RequestMessage;
        $msg->adoption_request_id = $adoptionRequest->id;
        $msg->sender_user_id = $user->id;
        $msg->body = trim($validated['body']);
        $msg->save();

        return ResponseResource::created([
            'id' => $msg->id,
            'sender_user_id' => $msg->sender_user_id,
            'sender_name' => $user->displayName(),
            'sender_role' => $user->getRole()->value,
            'body' => $msg->body,
            'created_at' => $msg->created_at?->toISOString(),
        ]);
    }

    public static function releasePetFromInProcess(Pet $pet, string $reason): void
    {
        $petBefore = $pet->getStatusEnum()->value;
        if ($pet->getStatusEnum() === PetStatus::InProcess) {
            $pet->status = PetStatus::LookingForAHome;
            $pet->save();

            ActivityLogger::log(
                type: ActivityLogType::StatusChange,
                action: 'pet_status_looking_for_home',
                actor: null,
                subject: $pet,
                before: $petBefore,
                after: PetStatus::LookingForAHome->value,
                reason: $reason,
            );
        }

        // Restore any On Hold requests for this pet back to Sent with a fresh 14-day clock (RQ-15).
        $now = now();
        $onHold = AdoptionRequest::query()
            ->where('pet_id', $pet->id)
            ->where('status', AdoptionRequestStatus::OnHold->value)
            ->get();

        foreach ($onHold as $req) {
            $req->status = AdoptionRequestStatus::Sent->value;
            $req->sent_at = $now;
            $req->expires_at = $now->copy()->addDays(self::EXPIRY_DAYS);
            $req->save();
        }
    }

    private function canView(AdoptionRequest $ar, User $user): bool
    {
        if ($user->isAdmin()) {
            return true;
        }
        if ($user->isPet()) {
            return $user->pet && $ar->pet_id === $user->pet->id;
        }
        if ($user->isHuman()) {
            return $user->homeProfile && $ar->home_profile_id === $user->homeProfile->id;
        }

        return false;
    }

    private function notifyParty(User $recipient, string $type, string $title, string $body, AdoptionRequest $ar): void
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
