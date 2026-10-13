<?php

declare(strict_types=1);

namespace App\Services\Analytics;

use App\Enums\AccountStatus;
use App\Enums\AdoptionRequestStatus;
use App\Enums\MeetAndGreetStatus;
use App\Enums\PetStatus;
use App\Enums\ReportStatus;
use App\Enums\Role;
use App\Models\AdoptionRequest;
use App\Models\MeetAndGreet;
use App\Models\Pet;
use App\Models\Report;
use App\Models\User;
use App\Support\PhilippineTime;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

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

    /** Revision-checked aggregates only. Never cache identities, authorization or user-specific queues. */
    public function metrics(): array
    {
        $read = fn () => ['tiles' => $this->tiles(), 'trends' => $this->monthlyTrends()];
        $store = config('performance.dashboard_cache_store');
        if (! $store || DB::transactionLevel() > 0 || ! in_array(DB::getDriverName(), ['pgsql', 'sqlite'], true)) {
            return $read();
        }
        $revision = DB::table('read_cache_versions')->where('name', 'admin-dashboard')->value('version');
        if ($revision === null) {
            return $read();
        }
        $ttl = max(1, (int) config('performance.dashboard_metrics_ttl', 15));
        // The time bucket also expires clock-dependent counts, even without a database write.
        $connection = config('database.connections.'.config('database.default'));
        $databaseScope = hash('sha256', json_encode([$connection['host'] ?? null, $connection['database'] ?? null, $connection['username'] ?? null, config('app.key')]));
        $key = 'admin:dashboard-metrics:v1:'.$databaseScope.':'.$revision.':'.intdiv(now()->timestamp, $ttl);
        $cache = null;
        try {
            $cache = Cache::store($store);
            if (is_array($metrics = $cache->get($key))) {
                return $metrics;
            }
        } catch (Throwable $error) {
            Log::warning('Dashboard metrics cache unavailable.', ['exception' => $error::class]);
            $cache = null;
        }
        $metrics = $read();
        if ($cache) {
            try {
                $cache->put($key, $metrics, $ttl);
            } catch (Throwable $error) {
                Log::warning('Dashboard metrics cache unavailable.', ['exception' => $error::class]);
            }
        }

        return $metrics;
    }

    /**
     * @return array<string, mixed>
     */
    public function tiles(): array
    {
        $members = fn (): Builder => User::query()->whereIn('role', [Role::Pet->value, Role::Human->value]);
        $accountGroups = $members()->selectRaw('role, status, count(*) as total')->groupBy('role', 'status')->get();
        $byStatus = $accountGroups->groupBy('status')->map(fn ($rows) => $rows->sum('total'));
        $byRole = $accountGroups->groupBy('role')->map(fn ($rows) => $rows->sum('total'));
        $accountCount = fn (AccountStatus $status): int => (int) ($byStatus[$status->value] ?? 0);
        $active = fn (Role $role): int => (int) $accountGroups->where('role', $role->value)->where('status', AccountStatus::Active->value)->sum('total');

        $petsByStatus = Pet::query()->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status');
        $pets = [];
        foreach (PetStatus::cases() as $status) {
            $pets[$status->value] = (int) ($petsByStatus[$status->value] ?? 0);
        }

        $meetings = MeetAndGreet::query()->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status');
        $meetingCount = fn (MeetAndGreetStatus $status): int => (int) ($meetings[$status->value] ?? 0);

        $adoptions = $this->adoptionTotals();

        $requestsByStatus = AdoptionRequest::query()->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status');
        $pending = $accountCount(AccountStatus::PendingVerification);

        return [
            'accounts' => [
                'total' => (int) $byStatus->sum(),
                'active' => $accountCount(AccountStatus::Active),
                'pending_verification' => $pending,
                'denied' => $accountCount(AccountStatus::Denied),
                'suspended' => $accountCount(AccountStatus::Suspended),
                'deactivated' => $accountCount(AccountStatus::Deactivated),
                'pets' => (int) ($byRole[Role::Pet->value] ?? 0),
                'humans' => (int) ($byRole[Role::Human->value] ?? 0),
                'active_pets' => $active(Role::Pet),
                'active_humans' => $active(Role::Human),
            ],
            'verification_queue_count' => $pending,
            'open_reports_count' => Report::query()->where('status', ReportStatus::Open->value)->count(),
            'pets_by_status' => $pets,
            'requests' => [
                'total' => (int) $requestsByStatus->sum(),
                'open' => (int) $requestsByStatus->only(AdoptionRequest::OPEN_STATUSES)->sum(),
                'in_process' => (int) $requestsByStatus->only(AdoptionRequest::IN_PROCESS_STATUSES)->sum(),
                'adopted' => (int) ($requestsByStatus[AdoptionRequestStatus::Adopted->value] ?? 0),
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
            'adoptions_count' => (int) $adoptions->total,
            'adoptions_this_month' => (int) $adoptions->this_month,
            'adoptions_last_month' => (int) $adoptions->last_month,
            'average_days_to_adoption' => round((float) ($adoptions->average_days ?? 0), 1),
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

        $sent = $this->monthTotals('adoption_requests', 'sent_at', $since);
        $approved = $this->monthTotals('adoption_requests', 'approved_at', $since);
        $adopted = $this->monthTotals('adoptions', 'adopted_at', $since);

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
            ->select(['id', 'name', 'role', 'status', 'created_at'])
            ->with(['pet:id,user_id,name', 'homeProfile:id,user_id,full_name',
                'verificationSubmission:verification_submissions.id,verification_submissions.user_id,verification_submissions.submitted_at'])
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
            ->with(['reportedUser:id,name,role,status', 'reportedUser.pet:id,user_id,name', 'reportedUser.homeProfile:id,user_id,full_name'])
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

    private function adoptionTotals(): object
    {
        $month = Carbon::now(PhilippineTime::TIME_ZONE)->startOfMonth();
        $start = $month->copy()->utc();
        $previous = $month->copy()->subMonth()->utc();
        $end = $month->copy()->addMonth()->utc();
        $days = match (DB::getDriverName()) {
            'pgsql' => 'GREATEST(1, FLOOR(EXTRACT(EPOCH FROM (adoptions.adopted_at - ar.sent_at)) / 86400))',
            'sqlite' => 'MAX(1, CAST(julianday(adoptions.adopted_at) - julianday(ar.sent_at) AS INTEGER))',
            default => 'GREATEST(1, TIMESTAMPDIFF(DAY, ar.sent_at, adoptions.adopted_at))',
        };

        return DB::table('adoptions')->whereNull('adoptions.link_removed_at')
            ->leftJoin('adoption_requests as ar', 'ar.id', '=', 'adoptions.adoption_request_id')
            ->selectRaw('COUNT(*) AS total')
            ->selectRaw('SUM(CASE WHEN adoptions.adopted_at >= ? AND adoptions.adopted_at < ? THEN 1 ELSE 0 END) AS this_month', [$start, $end])
            ->selectRaw('SUM(CASE WHEN adoptions.adopted_at >= ? AND adoptions.adopted_at < ? THEN 1 ELSE 0 END) AS last_month', [$previous, $start])
            ->selectRaw("AVG(CASE WHEN ar.sent_at IS NOT NULL AND adoptions.adopted_at IS NOT NULL THEN $days END) AS average_days")
            ->first();
    }

    private function monthTotals(string $table, string $column, Carbon $since): Collection
    {
        // Table/column names are internal constants, never request values. Stored dates are UTC.
        $month = match (DB::getDriverName()) {
            'pgsql' => "to_char($column + interval '8 hours', 'YYYY-MM')",
            'sqlite' => "strftime('%Y-%m', $column, '+8 hours')",
            default => "DATE_FORMAT(DATE_ADD($column, INTERVAL 8 HOUR), '%Y-%m')",
        };
        $query = DB::table($table)->where($column, '>=', $since);
        if ($table === 'adoptions') {
            $query->whereNull('link_removed_at');
        }

        return $query->selectRaw("$month AS month, COUNT(*) AS total")->groupByRaw($month)->pluck('total', 'month');
    }
}
