<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Analytics;

use App\Http\Controllers\Controller;
use App\Http\Resources\AdoptionRequests\AdoptionRequestResource;
use App\Http\Resources\ErrorResource;
use App\Http\Resources\ResponseResource;
use App\Models\AdoptionRequest;
use App\Models\Report;
use App\Models\User;
use App\Services\Analytics\MemberStats;
use App\Services\Analytics\PlatformDashboard;
use Illuminate\Http\Request;

/**
 * Member stats (Pet AN-01 & Human AN-02) and Admin platform analytics dashboard (AN-03, BE-25, FR30, FR40).
 */
class AnalyticsController extends Controller
{
    /** The latest requests a stats page lists; the whole history is on the Requests page. */
    public const HISTORY_LIMIT = 10;

    public function __construct(
        private readonly MemberStats $stats,
        private readonly PlatformDashboard $dashboard,
    ) {}

    public function stats(Request $request)
    {
        $user = $request->user();

        if ($user->isPet() && $user->pet) {
            return ResponseResource::make([
                ...$this->stats->forPet($user->pet),
                'request_history' => $this->requestHistory($request, 'pet_id', $user->pet->id),
            ]);
        }

        if ($user->isHuman() && $user->homeProfile) {
            return ResponseResource::make([
                ...$this->stats->forHuman($user, $user->homeProfile),
                'request_history' => $this->requestHistory($request, 'home_profile_id', $user->homeProfile->id),
            ]);
        }

        return ErrorResource::forbidden('Stats are for Pet and Human accounts.')->toResponse($request);
    }

    public function adminDashboard(Request $request)
    {
        $pending = $this->dashboard->pendingVerifications();
        $submittedAt = fn (User $account) => ($account->verificationSubmission?->submitted_at ?? $account->created_at)?->toISOString();

        return ResponseResource::make([
            'tiles' => [
                ...$this->dashboard->tiles(),
                // How long the account at the front of the queue has waited; null when the queue is empty.
                'oldest_verification_at' => $pending->first() ? $submittedAt($pending->first()) : null,
            ],
            'trends' => $this->dashboard->monthlyTrends(),
            'needs_attention' => [
                'pending_verifications' => $pending->map(fn (User $account) => [
                    'id' => $account->id,
                    'role' => $account->getRole()->value,
                    'display_name' => $account->displayName(),
                    'submitted_at' => $submittedAt($account),
                ])->values()->all(),
                'open_reports' => $this->dashboard->openReports()->map(fn (Report $report) => [
                    'id' => $report->id,
                    'target_type' => $report->target_type,
                    'reason' => $report->reason,
                    'reported_user_name' => $report->reportedUser?->displayName(),
                    'created_at' => $report->created_at?->toISOString(),
                ])->values()->all(),
                'overdue_requests' => $this->dashboard->overdueRequests()->map(fn (AdoptionRequest $ar) => $this->summary($request, $ar))->values()->all(),
            ],
        ]);
    }

    /**
     * The account's latest requests, newest first, as a list names them: no Meet & Greet and no contact detail
     * (SEC-PRIV-02).
     *
     * @return list<array<string, mixed>>
     */
    private function requestHistory(Request $request, string $column, int $id): array
    {
        return AdoptionRequest::query()
            ->with(['pet.photos', 'homeProfile.householdMembers'])
            ->where($column, $id)
            ->orderByDesc('sent_at')
            ->orderByDesc('id')
            ->limit(self::HISTORY_LIMIT)
            ->get()
            ->map(fn (AdoptionRequest $ar) => $this->summary($request, $ar))
            ->values()
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    private function summary(Request $request, AdoptionRequest $ar): array
    {
        return [...(new AdoptionRequestResource($ar))->toArray($request), 'updated_at' => $ar->updated_at?->toISOString()];
    }
}
