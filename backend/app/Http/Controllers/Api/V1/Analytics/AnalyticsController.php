<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Analytics;

use App\Enums\AccountStatus;
use App\Enums\AdoptionRequestStatus;
use App\Enums\MeetAndGreetStatus;
use App\Enums\PetStatus;
use App\Enums\ProfileViewSource;
use App\Enums\ReportStatus;
use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Http\Resources\AdoptionRequests\AdoptionRequestResource;
use App\Http\Resources\ErrorResource;
use App\Http\Resources\ResponseResource;
use App\Models\Adoption;
use App\Models\AdoptionRequest;
use App\Models\Bookmark;
use App\Models\Invite;
use App\Models\MatchScore;
use App\Models\MeetAndGreet;
use App\Models\Pet;
use App\Models\ProfileView;
use App\Models\Report;
use App\Models\User;
use Illuminate\Http\Request;

/**
 * Member stats (Pet AN-01 & Human AN-02) and Admin platform analytics dashboard (AN-03, BE-25, FR30, FR40).
 */
class AnalyticsController extends Controller
{
    public function stats(Request $request)
    {
        $user = $request->user();

        if ($user->isPet() && $user->pet) {
            $pet = $user->pet;

            $viewsCount = ProfileView::query()->where('pet_id', $pet->id)->count();
            $bookmarksCount = Bookmark::query()->where('pet_id', $pet->id)->count();
            $requestsCount = AdoptionRequest::query()->where('pet_id', $pet->id)->count();
            $invitesCount = Invite::query()->where('pet_id', $pet->id)->count();

            $viewsBySource = [];
            foreach (ProfileViewSource::cases() as $src) {
                $viewsBySource[$src->value] = ProfileView::query()
                    ->where('pet_id', $pet->id)
                    ->where('source', $src->value)
                    ->count();
            }

            $viewsOverTime = [];
            for ($i = 13; $i >= 0; $i--) {
                $day = now()->subDays($i);
                $viewsOverTime[] = [
                    'date' => $day->format('Y-m-d'),
                    'count' => ProfileView::query()
                        ->where('pet_id', $pet->id)
                        ->whereBetween('created_at', [$day->copy()->startOfDay(), $day->copy()->endOfDay()])
                        ->count(),
                ];
            }

            $recentRequests = AdoptionRequest::query()
                ->with(['pet.photos', 'homeProfile'])
                ->where('pet_id', $pet->id)
                ->orderByDesc('sent_at')
                ->limit(10)
                ->get()
                ->map(fn (AdoptionRequest $ar) => (new AdoptionRequestResource($ar))->toArray($request))
                ->values()
                ->all();

            return ResponseResource::make([
                'role' => 'pet',
                'tiles' => [
                    'views' => $viewsCount,
                    'bookmarks' => $bookmarksCount,
                    'requests' => $requestsCount,
                    'invites' => $invitesCount,
                ],
                'views_by_source' => $viewsBySource,
                'views_over_time' => $viewsOverTime,
                'request_history' => $recentRequests,
            ]);
        }

        if ($user->isHuman() && $user->homeProfile) {
            $home = $user->homeProfile;

            $matchesCount = MatchScore::query()->where('home_profile_id', $home->id)->count();
            $bookmarksCount = Bookmark::query()->where('user_id', $user->id)->count();
            $requestsCount = AdoptionRequest::query()->where('home_profile_id', $home->id)->count();
            $adoptedCount = Adoption::query()->where('home_profile_id', $home->id)->active()->count();

            $matchDistribution = [
                'high' => MatchScore::query()->where('home_profile_id', $home->id)->where('score', '>=', 80)->count(),
                'medium' => MatchScore::query()->where('home_profile_id', $home->id)->whereBetween('score', [60, 79])->count(),
                'low' => MatchScore::query()->where('home_profile_id', $home->id)->where('score', '<', 60)->count(),
            ];

            $requestOutcomes = [];
            foreach (AdoptionRequestStatus::cases() as $statusCase) {
                $requestOutcomes[$statusCase->value] = AdoptionRequest::query()
                    ->where('home_profile_id', $home->id)
                    ->where('status', $statusCase->value)
                    ->count();
            }

            $recentRequests = AdoptionRequest::query()
                ->with(['pet.photos', 'homeProfile'])
                ->where('home_profile_id', $home->id)
                ->orderByDesc('sent_at')
                ->limit(10)
                ->get()
                ->map(fn (AdoptionRequest $ar) => (new AdoptionRequestResource($ar))->toArray($request))
                ->values()
                ->all();

            return ResponseResource::make([
                'role' => 'human',
                'tiles' => [
                    'matches' => $matchesCount,
                    'bookmarks' => $bookmarksCount,
                    'requests' => $requestsCount,
                    'adopted' => $adoptedCount,
                ],
                'match_score_distribution' => $matchDistribution,
                'request_outcomes' => $requestOutcomes,
                'request_history' => $recentRequests,
            ]);
        }

        return ErrorResource::forbidden('Stats are available for Pet and Furparent accounts.')->toResponse($request);
    }

    public function adminDashboard(Request $request)
    {
        $totalAccounts = User::query()->whereIn('role', [Role::Pet->value, Role::Human->value])->count();
        $activeAccounts = User::query()->whereIn('role', [Role::Pet->value, Role::Human->value])->where('status', AccountStatus::Active->value)->count();
        $pendingVerificationCount = User::query()->whereIn('role', [Role::Pet->value, Role::Human->value])->where('status', AccountStatus::PendingVerification->value)->count();
        $deniedAccounts = User::query()->whereIn('role', [Role::Pet->value, Role::Human->value])->where('status', AccountStatus::Denied->value)->count();
        $suspendedAccounts = User::query()->whereIn('role', [Role::Pet->value, Role::Human->value])->where('status', AccountStatus::Suspended->value)->count();
        $deactivatedAccounts = User::query()->whereIn('role', [Role::Pet->value, Role::Human->value])->where('status', AccountStatus::Deactivated->value)->count();

        $petsByStatus = [
            'draft' => Pet::query()->where('status', PetStatus::Draft->value)->count(),
            'looking_for_a_home' => Pet::query()->where('status', PetStatus::LookingForAHome->value)->count(),
            'in_process' => Pet::query()->where('status', PetStatus::InProcess->value)->count(),
            'adopted_hired' => Pet::query()->where('status', PetStatus::AdoptedHired->value)->count(),
        ];

        $overdueCount = AdoptionRequest::query()
            ->where('status', AdoptionRequestStatus::AwaitingDecision->value)
            ->where(function ($sub): void {
                $sub->whereNotNull('overdue_flagged_at')
                    ->orWhere('awaiting_decision_at', '<=', now()->subDays(7));
            })
            ->count();

        $requestsSummary = [
            'total' => AdoptionRequest::query()->count(),
            'open' => AdoptionRequest::query()->open()->count(),
            'in_process' => AdoptionRequest::query()->inProcess()->count(),
            'adopted' => AdoptionRequest::query()->where('status', AdoptionRequestStatus::Adopted->value)->count(),
            'overdue' => $overdueCount,
        ];

        $meetAndGreetsSummary = [
            'total' => MeetAndGreet::query()->count(),
            'booked' => MeetAndGreet::query()->where('status', MeetAndGreetStatus::Booked->value)->count(),
            'confirmed' => MeetAndGreet::query()->where('status', MeetAndGreetStatus::Confirmed->value)->count(),
            'ended' => MeetAndGreet::query()->where('status', MeetAndGreetStatus::Ended->value)->count(),
        ];

        $activeAdoptions = Adoption::query()->active()->with('request')->get();
        $daysSamples = $activeAdoptions
            ->filter(fn (Adoption $a) => $a->request?->sent_at !== null && $a->adopted_at !== null)
            ->map(fn (Adoption $a) => max(1, (int) $a->request->sent_at->diffInDays($a->adopted_at)));

        $avgDaysToAdoption = $daysSamples->isNotEmpty()
            ? round($daysSamples->avg(), 1)
            : 0.0;

        $openReportsCount = Report::query()->where('status', ReportStatus::Open->value)->count();

        $pendingVerifications = User::query()
            ->with(['pet', 'homeProfile', 'verificationSubmission'])
            ->whereIn('role', [Role::Pet->value, Role::Human->value])
            ->where('status', AccountStatus::PendingVerification->value)
            ->orderBy('created_at')
            ->limit(5)
            ->get()
            ->map(fn (User $u) => [
                'id' => $u->id,
                'role' => $u->getRole()->value,
                'display_name' => $u->displayName(),
                'submitted_at' => ($u->verificationSubmission?->submitted_at ?? $u->created_at)?->toISOString(),
            ])
            ->values()
            ->all();

        $openReports = Report::query()
            ->with('reportedUser')
            ->where('status', ReportStatus::Open->value)
            ->orderByDesc('created_at')
            ->limit(5)
            ->get()
            ->map(fn (Report $r) => [
                'id' => $r->id,
                'target_type' => $r->target_type,
                'reason' => $r->reason,
                'reported_user_name' => $r->reportedUser?->displayName(),
                'created_at' => $r->created_at?->toISOString(),
            ])
            ->values()
            ->all();

        $overdueRequests = AdoptionRequest::query()
            ->with(['pet.photos', 'homeProfile'])
            ->where('status', AdoptionRequestStatus::AwaitingDecision->value)
            ->where(function ($sub): void {
                $sub->whereNotNull('overdue_flagged_at')
                    ->orWhere('awaiting_decision_at', '<=', now()->subDays(7));
            })
            ->orderBy('awaiting_decision_at')
            ->limit(5)
            ->get()
            ->map(fn (AdoptionRequest $ar) => (new AdoptionRequestResource($ar))->toArray($request))
            ->values()
            ->all();

        return ResponseResource::make([
            'tiles' => [
                'accounts' => [
                    'total' => $totalAccounts,
                    'active' => $activeAccounts,
                    'pending_verification' => $pendingVerificationCount,
                    'denied' => $deniedAccounts,
                    'suspended' => $suspendedAccounts,
                    'deactivated' => $deactivatedAccounts,
                    'pets' => User::query()->where('role', Role::Pet->value)->count(),
                    'humans' => User::query()->where('role', Role::Human->value)->count(),
                ],
                'verification_queue_count' => $pendingVerificationCount,
                'open_reports_count' => $openReportsCount,
                'pets_by_status' => $petsByStatus,
                'requests' => $requestsSummary,
                'meet_and_greets' => $meetAndGreetsSummary,
                'adoptions_count' => $activeAdoptions->count(),
                'average_days_to_adoption' => $avgDaysToAdoption,
            ],
            'needs_attention' => [
                'pending_verifications' => $pendingVerifications,
                'open_reports' => $openReports,
                'overdue_requests' => $overdueRequests,
            ],
        ]);
    }
}
