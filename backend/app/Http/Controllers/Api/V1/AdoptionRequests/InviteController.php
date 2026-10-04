<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\AdoptionRequests;

use App\Enums\AccountStatus;
use App\Enums\ActivityLogType;
use App\Enums\AdoptionRequestStatus;
use App\Enums\NotificationType;
use App\Enums\PetStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\ErrorResource;
use App\Http\Resources\PaginatedResource;
use App\Http\Resources\Profiles\HomeProfileResource;
use App\Http\Resources\Profiles\PetResource;
use App\Http\Resources\ResponseResource;
use App\Models\AdoptionRequest;
use App\Models\Invite;
use App\Models\MatchScore;
use App\Models\Pet;
use App\Services\ActivityLogs\ActivityLogger;
use App\Services\Notifications\NotificationService;
use Illuminate\Http\Request;

/**
 * Invite to Apply workflow (BE-15, RQ-01, RQ-02, FR9).
 *
 * A Human (`home_profile_id`) nudges a Pet (`pet_id`) to apply, like a recruiter reaching out.
 */
class InviteController extends Controller
{
    public function __construct(
        private readonly NotificationService $notifications,
    ) {}

    public function index(Request $request)
    {
        $user = $request->user();
        $perPage = min(max((int) $request->query('per_page', 20), 1), 50);

        $query = Invite::query()
            ->with(['pet.photos', 'pet.temperamentTags', 'pet.skills', 'pet.specialNeeds', 'homeProfile.user', 'homeProfile.householdMembers', 'homeProfile.otherPets', 'homeProfile.acceptedSpecies', 'homeProfile.preferredSizes', 'homeProfile.preferredAges'])
            ->orderByDesc('created_at')
            ->orderByDesc('id');

        if ($user->isPet() && $user->pet) {
            $query->where('pet_id', $user->pet->id);
            if (! $request->boolean('include_dismissed')) {
                $query->whereNull('dismissed_at');
            }
        } elseif ($user->isHuman() && $user->homeProfile) {
            $query->where('home_profile_id', $user->homeProfile->id);
        } else {
            return ResponseResource::make([
                'items' => [],
                'meta' => ['page' => 1, 'current_page' => 1, 'per_page' => $perPage, 'total' => 0, 'last_page' => 1],
            ]);
        }

        $paginator = $query->paginate($perPage);

        return PaginatedResource::fromPaginator($paginator, function (Invite $invite) use ($request): array {
            $matchScore = MatchScore::query()
                ->where('pet_id', $invite->pet_id)
                ->where('home_profile_id', $invite->home_profile_id)
                ->value('score');

            // Check if there is an active 30-day cooldown after a decline (RQ-02, RQ-06).
            $lastDecline = AdoptionRequest::query()
                ->where('pet_id', $invite->pet_id)
                ->where('home_profile_id', $invite->home_profile_id)
                ->whereIn('status', [
                    AdoptionRequestStatus::Declined->value,
                    AdoptionRequestStatus::NotAdopted->value,
                ])
                ->orderByDesc('closed_at')
                ->first();

            $cooldownUntil = null;
            if ($lastDecline && $lastDecline->closed_at && $lastDecline->closed_at->copy()->addDays(30)->isFuture()) {
                $cooldownUntil = $lastDecline->closed_at->copy()->addDays(30)->toISOString();
            }

            return [
                'id' => $invite->id,
                'pet_id' => $invite->pet_id,
                'home_profile_id' => $invite->home_profile_id,
                'note' => $invite->note,
                'status' => $invite->dismissed_at !== null ? 'dismissed' : 'sent',
                'dismissed_at' => $invite->dismissed_at?->toISOString(),
                'cooldown_until' => $cooldownUntil,
                'match_score' => $matchScore !== null ? (int) $matchScore : null,
                'created_at' => $invite->created_at?->toISOString(),
                'pet' => $invite->pet ? PetResource::summary($invite->pet) : null,
                'home_profile' => $invite->homeProfile
                    ? (new HomeProfileResource($invite->homeProfile))
                        ->withMatch($matchScore !== null ? (int) $matchScore : null)
                        ->toArray($request)
                    : null,
            ];
        });
    }

    public function store(Request $request, Pet $pet)
    {
        $user = $request->user();

        if (! $user->isHuman() || ! $user->homeProfile) {
            return ErrorResource::forbidden('Only Furparent accounts can invite a pet to apply.')->toResponse($request);
        }

        $home = $user->homeProfile;

        if (! $home->is_open_to_adopt || ! $home->hasCompletedQuiz()) {
            return ErrorResource::conflict(
                'Complete your Home Profile and turn on Open to Adopt before sending invites.',
                'not_open_to_adopt',
            )->toResponse($request);
        }

        if ($pet->getStatusEnum() !== PetStatus::LookingForAHome || ! $pet->user || $pet->user->getStatus() !== AccountStatus::Active) {
            return ErrorResource::conflict(
                'This pet is not currently Looking for a Home.',
                'pet_not_looking_for_home',
            )->toResponse($request);
        }

        $validated = $request->validate([
            'note' => ['nullable', 'string', 'max:200'],
        ]);

        $alreadyInvited = Invite::query()
            ->where('pet_id', $pet->id)
            ->where('home_profile_id', $home->id)
            ->exists();

        if ($alreadyInvited) {
            return ErrorResource::conflict(
                "You have already invited {$pet->name} to apply.",
                'invite_already_sent',
            )->toResponse($request);
        }

        $invite = new Invite;
        $invite->pet_id = $pet->id;
        $invite->home_profile_id = $home->id;
        $invite->note = isset($validated['note']) && trim($validated['note']) !== '' ? trim($validated['note']) : null;
        $invite->save();

        // Respect notification preferences for requests_and_invites (BE-10).
        $prefs = $pet->user->notificationPreference;
        if (! $prefs || $prefs->shouldRequestAndInvite()) {
            $body = $invite->note
                ? "\"{$invite->note}\" — {$home->full_name} invited {$pet->name} to apply."
                : "{$home->full_name} in {$home->city} invited {$pet->name} to apply for their home.";

            $this->notifications->store(
                recipient: $pet->user,
                type: NotificationType::InviteSent->value,
                title: "{$home->full_name} invited you to apply!",
                body: $body,
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

        ActivityLogger::log(
            type: ActivityLogType::Request,
            action: 'invite_to_apply_sent',
            actor: $user,
            subject: $invite,
            userAgent: $request->userAgent(),
        );

        return ResponseResource::created([
            'id' => $invite->id,
            'pet_id' => $invite->pet_id,
            'home_profile_id' => $invite->home_profile_id,
            'note' => $invite->note,
            'status' => 'sent',
            'dismissed_at' => null,
            'created_at' => $invite->created_at?->toISOString(),
        ]);
    }

    public function dismiss(Request $request, Invite $invite)
    {
        $user = $request->user();

        if (! $user->isPet() || ! $user->pet || $invite->pet_id !== $user->pet->id) {
            return ErrorResource::forbidden('You can only dismiss invites sent to your pet.')->toResponse($request);
        }

        if ($invite->dismissed_at !== null) {
            return ErrorResource::conflict('This invite was already dismissed.', 'invite_already_dismissed')->toResponse($request);
        }

        $invite->dismissed_at = now();
        $invite->save();

        return ResponseResource::make([
            'id' => $invite->id,
            'status' => 'dismissed',
            'dismissed_at' => $invite->dismissed_at->toISOString(),
        ]);
    }
}
