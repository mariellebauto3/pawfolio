<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\AdoptionRequests;

use App\Enums\ActivityLogType;
use App\Enums\AdoptionRequestStatus;
use App\Enums\MeetAndGreetEndReason;
use App\Enums\MeetAndGreetStatus;
use App\Enums\NotificationType;
use App\Enums\PetStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\AdoptionRequests\ApproveAdoptionRequestRequest;
use App\Http\Requests\AdoptionRequests\DeclineAdoptionRequestRequest;
use App\Http\Requests\AdoptionRequests\ListAdoptionRequestsRequest;
use App\Http\Requests\AdoptionRequests\SendAdoptionRequestRequest;
use App\Http\Requests\AdoptionRequests\WithdrawAdoptionRequestRequest;
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

    /**
     * The caller's own requests, newest first: a pet's My requests (RQ-07, RQ-08) or a human's inbox (RQ-09, RQ-10).
     * `meta.status_counts` counts all of them by status, whatever the tab, for the tab counts and the "2 of 3 open"
     * line.
     */
    public function index(ListAdoptionRequestsRequest $request)
    {
        $user = $request->user();

        // Null only for an account with no profile row, which then has no requests either.
        $own = $user->isPet()
            ? ['pet_id' => $user->pet?->id ?? 0]
            : ['home_profile_id' => $user->homeProfile?->id ?? 0];

        $query = AdoptionRequest::query()
            ->where($own)
            ->with(['pet.photos', 'homeProfile.householdMembers'])
            ->orderByDesc('sent_at')
            ->orderByDesc('id');

        $statuses = $request->statuses();
        if ($statuses !== null) {
            $query->whereIn('status', $statuses);
        }

        $paginator = $query->paginate($request->perPage());

        $items = $paginator->getCollection()
            ->map(fn (AdoptionRequest $ar) => (new AdoptionRequestResource($ar))->toArray($request))
            ->values()
            ->all();

        $counts = AdoptionRequest::query()
            ->where($own)
            ->selectRaw('status, count(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status')
            ->map(fn ($total) => (int) $total);

        $page = ResponseResource::paginated($paginator, $items);

        return new ResponseResource($page->data, [...$page->meta, 'status_counts' => (object) $counts->all()], $page->links);
    }

    public function show(Request $request, int $adoptionRequest)
    {
        $user = $request->user();
        $ar = AdoptionRequest::query()
            ->with(['pet.photos', 'homeProfile.householdMembers', 'activeMeetAndGreet.slot', 'latestMeetAndGreet.slot'])
            ->find($adoptionRequest);

        // SEC-AUTHZ-03 / SEC-AUTHZ-04: Return 404 for someone else's request so IDs cannot be probed.
        if (! $ar || $user->cannot('view', $ar)) {
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

    /** `POST /home-profiles/{home}/adoption-requests`: the home is the one in the path. */
    public function storeForHome(SendAdoptionRequestRequest $request, int $home)
    {
        return $this->store($request);
    }

    public function store(SendAdoptionRequestRequest $request)
    {
        $user = $request->user();

        /** @var HomeProfile|null $home */
        $home = HomeProfile::query()->with('user')->find($request->homeProfileId());

        // A home the pet may not open answers like one that doesn't exist (HomeProfilePolicy, SEC-AUTHZ-04): a
        // suspended account's, or one with Open to Adopt off that the pet has no request or invite with. Otherwise
        // the refusal below would tell anyone who asks whose home an id is.
        if (! $home || $user->cannot('view', $home)) {
            return ErrorResource::notFound("We couldn't find that Home Profile.")->toResponse($request);
        }

        return DB::transaction(function () use ($user, $home, $request) {
            /** @var Pet $pet */
            $pet = Pet::query()->whereKey($user->pet->id)->lockForUpdate()->firstOrFail();

            if ($pet->getStatusEnum() === PetStatus::Draft) {
                return ErrorResource::conflict(
                    'Publish your resume before you send an adoption request.',
                    'pet_resume_draft',
                )->toResponse($request);
            }

            if ($pet->getStatusEnum() === PetStatus::AdoptedHired) {
                return ErrorResource::conflict(
                    "You've been adopted, so you can't send adoption requests.",
                    'already_adopted',
                )->toResponse($request);
            }

            if ($pet->getStatusEnum() === PetStatus::InProcess) {
                return ErrorResource::conflict(
                    'You already have a request in process. You can apply to other homes if it ends without an adoption.',
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
                    'You already have a request in process. You can apply to other homes if it ends without an adoption.',
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
            $ar->cover_letter = $request->coverLetter();
            $ar->caretaker_notes = $request->caretakerNotes();
            $ar->sent_at = $now;
            $ar->expires_at = $now->copy()->addDays(self::EXPIRY_DAYS);
            $ar->save();

            $this->notifyParty(
                recipient: $home->user,
                type: NotificationType::RequestReceived->value,
                title: "New adoption request from {$pet->name}",
                body: "{$pet->name} sent an adoption request with a cover letter and resume.",
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

            // How many are open now, this one included, for "Open requests: 2 of 3" on Request sent (RQ-04).
            return ResponseResource::created(
                (new AdoptionRequestResource($ar->load(['pet.photos', 'homeProfile.householdMembers'])))->toArray($request),
                ['open_requests' => $openRequests->count() + 1, 'max_open_requests' => self::MAX_OPEN_REQUESTS],
            )->toResponse($request);
        });
    }

    public function approve(ApproveAdoptionRequestRequest $request, int $adoptionRequest)
    {
        $user = $request->user();
        $adoptionRequest = AdoptionRequest::query()->find($adoptionRequest);

        // Anyone but the human it was sent to is answered like a request that doesn't exist (AdoptionRequestPolicy,
        // SEC-AUTHZ-04).
        if ($adoptionRequest === null || $user->cannot('approve', $adoptionRequest)) {
            return ErrorResource::notFound("We couldn't find that request.")->toResponse($request);
        }

        return DB::transaction(function () use ($adoptionRequest, $user, $request) {
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
            $ar->approval_message = $request->message();
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
                (new AdoptionRequestResource($ar->fresh(['pet.photos', 'homeProfile.householdMembers'])))
                    ->withDetails()
                    ->toArray($request),
            )->toResponse($request);
        });
    }

    public function decline(DeclineAdoptionRequestRequest $request, int $adoptionRequest)
    {
        $user = $request->user();
        $adoptionRequest = AdoptionRequest::query()->find($adoptionRequest);

        // Anyone but the human it was sent to is answered like a request that doesn't exist (AdoptionRequestPolicy,
        // SEC-AUTHZ-04).
        if ($adoptionRequest === null || $user->cannot('decline', $adoptionRequest)) {
            return ErrorResource::notFound("We couldn't find that request.")->toResponse($request);
        }

        return DB::transaction(function () use ($adoptionRequest, $user, $request) {
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
            $ar->decline_reason = $request->reason();
            $ar->decision_message = $request->message();
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
                (new AdoptionRequestResource($ar->fresh(['pet.photos', 'homeProfile.householdMembers'])))
                    ->withDetails()
                    ->toArray($request),
            )->toResponse($request);
        });
    }

    public function withdraw(WithdrawAdoptionRequestRequest $request, int $adoptionRequest)
    {
        $user = $request->user();
        $adoptionRequest = AdoptionRequest::query()->find($adoptionRequest);

        // Another pet's request, or anyone who isn't the pet that sent it, is answered like one that doesn't exist
        // (AdoptionRequestPolicy, SEC-AUTHZ-04).
        if ($adoptionRequest === null || $user->cannot('withdraw', $adoptionRequest)) {
            return ErrorResource::notFound("We couldn't find that request.")->toResponse($request);
        }

        return DB::transaction(function () use ($adoptionRequest, $user, $request) {
            /** @var AdoptionRequest $ar */
            $ar = AdoptionRequest::query()
                ->with(['pet', 'homeProfile.user', 'activeMeetAndGreet'])
                ->whereKey($adoptionRequest->id)
                ->lockForUpdate()
                ->firstOrFail();

            if (! $ar->isOpen()) {
                return ErrorResource::conflict(
                    'This request has already ended, so there is nothing to withdraw.',
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
            $ar->withdraw_reason = $request->reason();
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
                (new AdoptionRequestResource($ar->fresh(['pet.photos', 'homeProfile.householdMembers'])))
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
            // The fresh 14 days are the expiry's; `sent_at` stays the day the pet sent it (RQ-03).
            $req->expires_at = $now->copy()->addDays(self::EXPIRY_DAYS);
            $req->save();
        }
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
