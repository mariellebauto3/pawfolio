<?php

declare(strict_types=1);

namespace App\Services\Analytics;

use App\Enums\AccountStatus;
use App\Enums\AdoptionRequestStatus;
use App\Enums\MeetAndGreetStatus;
use App\Enums\PetStatus;
use App\Enums\ReportStatus;
use App\Enums\Role;
use App\Models\Adoption;
use App\Models\AdoptionRequest;
use App\Models\MeetAndGreet;
use App\Models\Pet;
use App\Models\Report;
use App\Models\User;
use App\Support\PhilippineTime;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * The platform's numbers for the admin dashboard (BE-25, AN-03, FR40): counts of accounts, pets, requests,
 * Meet & Greets and adoptions as they stand now, and how requests and adoptions moved over the last months.
 * Counts and dates only: no contact detail, document or address is read here (SEC-PRIV-01, SEC-PRIV-02).
 */
class PlatformDashboard
{
    /** The months the trend charts cover, this month included. */
    public const TREND_MONTHS = 6;

    /** A Sent request this close to its 14-day limit is "expiring soon". */
    public const EXPIRING_WITHIN_DAYS = 3;

    /** "This week" for Meet & Greets: the 7 days ahead. */
    public const UPCOMING_DAYS = 7;

    /**
     * @return array<string, mixed>
     */
    public function tiles(): array
    {
        $members = fn (): Builder => User::query()->whereIn('role', [Role::Pet->value, Role::Human->value]);
        $byStatus = $members()->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status');
        $accountCount = fn (AccountStatus $status): int => (int) ($byStatus[$status->value] ?? 0);
        $active = fn (Role $role): int => User::query()->where('role', $role->value)->where('status', AccountStatus::Active->value)->count();

        $petsByStatus = Pet::query()->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status');
        $pets = [];
        foreach (PetStatus::cases() as $status) {
            $pets[$status->value] = (int) ($petsByStatus[$status->value] ?? 0);
        }

        $meetings = MeetAndGreet::query()->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status');
        $meetingCount = fn (MeetAndGreetStatus $status): int => (int) ($meetings[$status->value] ?? 0);

        $adoptions = Adoption::query()->active()->with('request')->get();
        $days = $adoptions
            ->filter(fn (Adoption $adoption) => $adoption->request?->sent_at !== null && $adoption->adopted_at !== null)
            ->map(fn (Adoption $adoption) => max(1, (int) $adoption->request->sent_at->diffInDays($adoption->adopted_at)));
        $thisMonth = Carbon::now(PhilippineTime::TIME_ZONE)->format('Y-m');
        $lastMonth = Carbon::now(PhilippineTime::TIME_ZONE)->startOfMonth()->subMonth()->format('Y-m');
        $adoptedIn = $adoptions->filter(fn (Adoption $adoption) => $adoption->adopted_at !== null)->countBy(fn (Adoption $adoption) => $this->month($adoption->adopted_at));

        $pending = $accountCount(AccountStatus::PendingVerification);

        return [
            'accounts' => [
                'total' => (int) $byStatus->sum(),
                'active' => $accountCount(AccountStatus::Active),
                'pending_verification' => $pending,
                'denied' => $accountCount(AccountStatus::Denied),
                'suspended' => $accountCount(AccountStatus::Suspended),
                'deactivated' => $accountCount(AccountStatus::Deactivated),
                'pets' => $members()->where('role', Role::Pet->value)->count(),
                'humans' => $members()->where('role', Role::Human->value)->count(),
                'active_pets' => $active(Role::Pet),
                'active_humans' => $active(Role::Human),
            ],
            'verification_queue_count' => $pending,
            'open_reports_count' => Report::query()->where('status', ReportStatus::Open->value)->count(),
            'pets_by_status' => $pets,
            'requests' => [
                'total' => AdoptionRequest::query()->count(),
                'open' => AdoptionRequest::query()->open()->count(),
                'in_process' => AdoptionRequest::query()->inProcess()->count(),
                'adopted' => AdoptionRequest::query()->where('status', AdoptionRequestStatus::Adopted->value)->count(),
                'overdue' => AdoptionRequest::query()->overdue()->count(),
                'expiring_soon' => AdoptionRequest::query()
                    ->where('status', AdoptionRequestStatus::Sent->value)
                    ->whereBetween('expires_at', [now(), now()->addDays(self::EXPIRING_WITHIN_DAYS)])
                    ->count(),
            ],
            'meet_and_greets' => [
                'total' => (int) $meetings->sum(),
                'booked' => $meetingCount(MeetAndGreetStatus::Booked),
                'confirmed' => $meetingCount(MeetAndGreetStatus::Confirmed),
                'ended' => $meetingCount(MeetAndGreetStatus::Ended),
                // Still to take place in the 7 days ahead, confirmed or waiting for the human to confirm.
                'upcoming_week' => MeetAndGreet::query()
                    ->whereIn('status', [MeetAndGreetStatus::Booked->value, MeetAndGreetStatus::Confirmed->value])
                    ->whereHas('slot', fn (Builder $slot) => $slot->whereBetween('starts_at', [now(), now()->addDays(self::UPCOMING_DAYS)]))
                    ->count(),
            ],
            'adoptions_count' => $adoptions->count(),
            'adoptions_this_month' => (int) ($adoptedIn[$thisMonth] ?? 0),
            'adoptions_last_month' => (int) ($adoptedIn[$lastMonth] ?? 0),
            'average_days_to_adoption' => $days->isNotEmpty() ? round($days->avg(), 1) : 0.0,
        ];
    }

    /**
     * Requests sent and approved, and adoptions, in each of the last 6 months, oldest first. A month is a month in
     * the Philippines, and it is counted here rather than in SQL, so the same code runs on every database engine.
     *
     * @return list<array{month: string, sent: int, approved: int, adopted: int}>
     */
    public function monthlyTrends(): array
    {
        $first = Carbon::now(PhilippineTime::TIME_ZONE)->startOfMonth()->subMonths(self::TREND_MONTHS - 1);
        $since = $first->copy()->utc();

        $sent = $this->perMonth(AdoptionRequest::query()->where('sent_at', '>=', $since)->pluck('sent_at'));
        $approved = $this->perMonth(AdoptionRequest::query()->where('approved_at', '>=', $since)->pluck('approved_at'));
        $adopted = $this->perMonth(Adoption::query()->active()->where('adopted_at', '>=', $since)->pluck('adopted_at'));

        $months = [];
        for ($i = 0; $i < self::TREND_MONTHS; $i++) {
            $month = $first->copy()->addMonths($i)->format('Y-m');
            $months[] = [
                'month' => $month,
                'sent' => (int) ($sent[$month] ?? 0),
                'approved' => (int) ($approved[$month] ?? 0),
                'adopted' => (int) ($adopted[$month] ?? 0),
            ];
        }

        return $months;
    }

    /** The accounts waiting for verification, longest wait first. */
    public function pendingVerifications(int $limit = 5): Collection
    {
        return User::query()
            ->with(['pet', 'homeProfile', 'verificationSubmission'])
            ->whereIn('role', [Role::Pet->value, Role::Human->value])
            ->where('status', AccountStatus::PendingVerification->value)
            ->orderBy('created_at')
            ->limit($limit)
            ->get();
    }

    /** The newest open reports. */
    public function openReports(int $limit = 5): Collection
    {
        return Report::query()
            ->with('reportedUser')
            ->where('status', ReportStatus::Open->value)
            ->orderByDesc('created_at')
            ->limit($limit)
            ->get();
    }

    /** The requests overdue for a decision, longest wait first (§5.4, MG-16). */
    public function overdueRequests(int $limit = 5): Collection
    {
        return AdoptionRequest::query()
            ->with(['pet.photos', 'homeProfile.householdMembers'])
            ->overdue()
            ->orderBy('awaiting_decision_at')
            ->limit($limit)
            ->get();
    }

    private function month(mixed $at): string
    {
        return Carbon::parse($at)->setTimezone(PhilippineTime::TIME_ZONE)->format('Y-m');
    }

    private function perMonth(Collection $dates): Collection
    {
        return $dates->filter()->countBy(fn ($at) => $this->month($at));
    }
}
