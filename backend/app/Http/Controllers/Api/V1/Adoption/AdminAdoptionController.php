<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Adoption;

use App\Actions\Adoption\ResolveAdoptionIssue;
use App\Actions\AdoptionRequests\SendRequestReminder;
use App\Enums\AdoptionAction;
use App\Enums\AdoptionRequestStatus;
use App\Enums\MeetAndGreetStatus;
use App\Exceptions\ReminderRefused;
use App\Exceptions\ResolutionRefused;
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
use App\Services\Matching\MatchScoreCalculator;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * The admin's side of adoption (BE-20, FE-23, docs/api/adoption-and-meet-greet.md): the monitor of every request
 * and Meet & Greet with the ones overdue for a decision (RQ-18, MG-15, MG-16, FR36), one request's record and a
 * reminder to whoever it waits on (RQ-19), Resolve adoption issue (AL-07, AL-08, FR37) and the alumni list (AL-09,
 * FR38). Every route is under /admin and checks the admin role (SEC-AUTHZ-07). Nothing here sets a status: the
 * resolution is an action with a reason, applied and logged by ResolveAdoptionIssue (FR27, NFR9).
 */
class AdminAdoptionController extends Controller
{
    private const TABS = ['all', 'meet_and_greets', 'overdue'];

    public function __construct(
        private readonly MatchScoreCalculator $matcher,
        private readonly ResolveAdoptionIssue $resolveIssue,
    ) {}

    public function requestsIndex(Request $request)
    {
        // Filters are allow-listed: an unknown value is refused, not passed on (SEC-INPUT-03).
        $filters = $request->validate([
            'tab' => ['sometimes', 'string', Rule::in(self::TABS)],
            'status' => ['sometimes', 'string', Rule::enum(AdoptionRequestStatus::class)],
            'q' => ['sometimes', 'nullable', 'string', 'max:100'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:50'],
        ]);

        $query = AdoptionRequest::query()
            ->with(['pet.photos', 'homeProfile.householdMembers', 'latestMeetAndGreet.slot', 'latestMeetAndGreet.proposedSlot', 'latestMeetAndGreet.endedBy'])
            ->orderByDesc('sent_at')
            ->orderByDesc('id');

        $tab = $filters['tab'] ?? 'all';
        if ($tab === 'overdue') {
            $query->overdue();
        } elseif ($tab === 'meet_and_greets') {
            $query->whereHas('meetAndGreets');
        }

        if (isset($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        $term = trim((string) ($filters['q'] ?? ''));
        if ($term !== '') {
            $like = '%'.addcslashes($term, '%_\\').'%';
            $query->where(function ($sub) use ($like): void {
                $sub->whereHas('pet', fn ($p) => $p->where('name', 'like', $like))
                    ->orWhereHas('homeProfile', fn ($h) => $h->where('full_name', 'like', $like));
            });
        }

        $paginator = $query->paginate((int) ($filters['per_page'] ?? 20));

        return PaginatedResource::fromPaginator($paginator, fn (AdoptionRequest $ar): array => [
            ...(new AdoptionRequestResource($ar))->toArray($request),
            'updated_at' => $ar->updated_at?->toISOString(),
            'is_overdue' => $ar->isOverdue(),
            'latest_meet_and_greet' => $ar->latestMeetAndGreet
                ? AdoptionRequestResource::formatMeetAndGreet($ar->latestMeetAndGreet)
                : null,
        ]);
    }

    public function requestShow(Request $request, AdoptionRequest $adoptionRequest)
    {
        $adoptionRequest->load(['pet.photos', 'pet.user', 'homeProfile.user', 'activeMeetAndGreet.slot', 'latestMeetAndGreet.slot', 'adoption']);

        $data = (new AdoptionRequestResource($adoptionRequest))
            ->withDetails()
            ->toArray($request);

        // Monitoring a request doesn't need the two sides' phone numbers or the street address, so the record
        // carries none, like the admin's account page (SEC-PRIV-02). The slots to book are the two sides' as well.
        unset($data['contacts'], $data['unlocked_contact'], $data['contact_unlocked'], $data['available_slots']);

        $data['updated_at'] = $adoptionRequest->updated_at?->toISOString();
        $data['is_overdue'] = $adoptionRequest->isOverdue();
        // The two accounts, for the links to their pages (AC-07). The email is how an admin tells accounts apart.
        $data['parties'] = [
            'pet_user_id' => $adoptionRequest->pet?->user_id,
            'pet_email' => $adoptionRequest->pet?->user?->email,
            'pet_account_status' => $adoptionRequest->pet?->user?->getStatus()->value,
            'human_user_id' => $adoptionRequest->homeProfile?->user_id,
            'human_email' => $adoptionRequest->homeProfile?->user?->email,
            'human_account_status' => $adoptionRequest->homeProfile?->user?->getStatus()->value,
        ];
        // Who a reminder would go to, so the screen offers one only when the API would send it (SEC-FE-05).
        $waitingOn = SendRequestReminder::waitingOn($adoptionRequest);
        $lastReminder = SendRequestReminder::lastSentAt($adoptionRequest);
        $data['reminder'] = [
            'waiting_on' => $waitingOn,
            'last_sent_at' => $lastReminder?->toISOString(),
            'can_send' => $waitingOn !== null && ! SendRequestReminder::sentRecently($adoptionRequest),
        ];
        // What admins changed on this request by hand, oldest first, for its timeline (NFR9).
        $data['resolutions'] = AdoptionResolution::query()
            ->with(['admin', 'pet', 'request.homeProfile'])
            ->where('adoption_request_id', $adoptionRequest->id)
            ->orderBy('id')
            ->get()
            ->map(fn (AdoptionResolution $resolution): array => $this->formatResolution($resolution))
            ->all();

        return ResponseResource::make($data);
    }

    public function sendReminder(Request $request, AdoptionRequest $adoptionRequest, SendRequestReminder $remind)
    {
        try {
            $side = $remind->handle($adoptionRequest, $request->user(), $request->userAgent());
        } catch (ReminderRefused $refused) {
            return ErrorResource::conflict($refused->getMessage(), $refused->reason)->toResponse($request);
        }

        return ResponseResource::make([
            'reminded' => true,
            'recipient' => $side,
            'recipient_name' => $side === 'pet' ? $adoptionRequest->pet?->name : $adoptionRequest->homeProfile?->full_name,
        ]);
    }

    public function meetAndGreetsIndex(Request $request)
    {
        $filters = $request->validate([
            'status' => ['sometimes', 'string', Rule::enum(MeetAndGreetStatus::class)],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:50'],
        ]);

        $query = MeetAndGreet::query()
            ->with(['slot', 'proposedSlot', 'endedBy', 'request.pet.photos', 'request.homeProfile'])
            ->orderByDesc('booked_at')
            ->orderByDesc('id');

        if (isset($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        $paginator = $query->paginate((int) ($filters['per_page'] ?? 20));

        return PaginatedResource::fromPaginator($paginator, function (MeetAndGreet $mg): array {
            $formatted = AdoptionRequestResource::formatMeetAndGreet($mg);
            $formatted['pet'] = $mg->request?->pet ? PetResource::summary($mg->request->pet) : null;
            $formatted['home_profile'] = $mg->request?->homeProfile ? HomeProfileResource::summary($mg->request->homeProfile) : null;
            $formatted['request_status'] = $mg->request?->getStatus()->value;

            return $formatted;
        });
    }

    /** AL-07: the pet with its Furparent link and its requests, and which of the four actions each one offers now. */
    public function resolveOptions(Pet $pet)
    {
        return ResponseResource::make([
            'pet' => [...PetResource::summary($pet), 'user_id' => $pet->user_id],
            ...$this->resolveIssue->options($pet),
        ]);
    }

    /** AL-08: what the action would change, before anything is written. */
    public function resolvePreview(Request $request, Pet $pet)
    {
        $validated = $request->validate($this->resolutionRules(), $this->resolutionMessages());

        try {
            $change = $this->resolveIssue->preview($pet, AdoptionAction::from($validated['action']), $this->requestId($validated));
        } catch (ResolutionRefused $refused) {
            return ErrorResource::conflict($refused->getMessage(), $refused->reason)->toResponse($request);
        }

        return ResponseResource::make($change);
    }

    public function resolve(Request $request, Pet $pet)
    {
        $validated = $request->validate(
            [...$this->resolutionRules(), 'reason' => ['required', 'string', 'max:1000']],
            [...$this->resolutionMessages(), 'reason.required' => 'Enter a reason for this change.', 'reason.max' => 'Keep the reason to 1000 characters or fewer.'],
        );

        try {
            ['resolution' => $resolution, 'change' => $change] = $this->resolveIssue->handle(
                $pet,
                $request->user(),
                AdoptionAction::from($validated['action']),
                $this->requestId($validated),
                trim($validated['reason']),
                $request->userAgent(),
            );
        } catch (ResolutionRefused $refused) {
            return ErrorResource::conflict($refused->getMessage(), $refused->reason)->toResponse($request);
        }

        // Looking for a Home again puts the pet back in search and matches; any other status keeps it out.
        $pet->refresh();
        $this->matcher->recalculateForPet($pet);

        return ResponseResource::make([
            ...$this->formatResolution($resolution->load(['admin', 'pet', 'request.homeProfile'])),
            'pet_status' => $pet->getStatusEnum()->value,
            'change' => $change,
        ]);
    }

    /** AL-07 "Recent resolutions": every manual change, newest first, with who made it and why (NFR9). */
    public function resolutionsIndex(Request $request)
    {
        $filters = $request->validate([
            'pet_id' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:50'],
        ]);

        $query = AdoptionResolution::query()
            ->with(['admin', 'pet', 'request.homeProfile'])
            ->orderByDesc('created_at')
            ->orderByDesc('id');

        if (isset($filters['pet_id'])) {
            $query->where('pet_id', $filters['pet_id']);
        }

        return PaginatedResource::fromPaginator(
            $query->paginate((int) ($filters['per_page'] ?? 20)),
            fn (AdoptionResolution $resolution): array => $this->formatResolution($resolution),
        );
    }

    public function alumniIndex(Request $request)
    {
        $filters = $request->validate([
            'include_removed' => ['sometimes', 'boolean'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:50'],
        ]);

        $query = Adoption::query()
            ->with(['pet.photos', 'homeProfile', 'request'])
            ->orderByDesc('adopted_at')
            ->orderByDesc('id');

        if (! $request->boolean('include_removed')) {
            $query->whereNull('link_removed_at');
        }

        $paginator = $query->paginate((int) ($filters['per_page'] ?? 20));

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

    /** @return array<string, mixed> */
    private function resolutionRules(): array
    {
        return [
            'action' => ['required', 'string', Rule::enum(AdoptionAction::class)],
            'adoption_request_id' => ['sometimes', 'nullable', 'integer', 'min:1'],
        ];
    }

    /** @return array<string, string> */
    private function resolutionMessages(): array
    {
        return [
            'action.*' => 'Choose what to change.',
            'adoption_request_id.*' => 'Choose a request from the list.',
        ];
    }

    /** @param  array<string, mixed>  $validated */
    private function requestId(array $validated): ?int
    {
        return isset($validated['adoption_request_id']) ? (int) $validated['adoption_request_id'] : null;
    }

    /** @return array<string, mixed> */
    private function formatResolution(AdoptionResolution $resolution): array
    {
        return [
            'id' => $resolution->id,
            'action' => $resolution->getAction()->value,
            'reason' => $resolution->reason,
            'pet' => $resolution->pet ? ['id' => $resolution->pet->id, 'name' => $resolution->pet->name] : null,
            'adoption_request_id' => $resolution->adoption_request_id,
            'home_name' => $resolution->request?->homeProfile?->full_name,
            'admin_name' => $resolution->admin?->displayName(),
            'created_at' => $resolution->created_at?->toISOString(),
        ];
    }
}
