<?php

declare(strict_types=1);

namespace App\Services\Analytics;

use App\Enums\AccountStatus;
use App\Enums\AdoptionRequestStatus;
use App\Enums\MeetAndGreetStatus;
use App\Enums\PetStatus;
use App\Enums\ProfileViewSource;
use App\Models\Adoption;
use App\Models\AdoptionRequest;
use App\Models\Bookmark;
use App\Models\HomeProfile;
use App\Models\Invite;
use App\Models\MatchScore;
use App\Models\Pet;
use App\Models\ProfileView;
use App\Models\User;
use App\Support\PhilippineTime;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;

/**
 * A member's own numbers (BE-25, FR30): how a pet's resume is doing (AN-01), and a human's matches and requests
 * (AN-02). Every count is about the account that asks, read from its own rows; nothing here names who viewed or
 * bookmarked a profile.
 */
class MemberStats
{
    /** The days the views chart covers, today included (AN-01: "Profile views (last 30 days)"). */
    public const VIEW_DAYS = 30;

    /** "This week" on a tile: the last 7 days. */
    public const RECENT_DAYS = 7;

    /** A match this strong or stronger is counted on the Pets matched tile (AN-02: "80%+ match"). */
    public const STRONG_MATCH = 80;

    /** The match score bands of the histogram (AN-02), best first: [from, to]. */
    public const SCORE_BANDS = [[90, 100], [80, 89], [70, 79], [60, 69], [0, 59]];

    /** How many adopted pets the Pets adopted tile names. */
    public const ADOPTED_NAMES = 3;

    /**
     * @return array<string, mixed>
     */
    public function forPet(Pet $pet): array
    {
        $recent = now()->subDays(self::RECENT_DAYS);
        $views = ProfileView::query()->where('pet_id', $pet->id);
        $bookmarks = Bookmark::query()->where('pet_id', $pet->id);
        $requests = AdoptionRequest::query()->where('pet_id', $pet->id);
        $invites = Invite::query()->where('pet_id', $pet->id);

        $viewCounts = $this->recentCounts($views, $recent);
        $bookmarkCounts = $this->recentCounts($bookmarks, $recent);
        $requestCounts = (clone $requests)->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status');
        $inviteCounts = (clone $invites)->selectRaw('count(*) as total, count(CASE WHEN dismissed_at IS NULL THEN 1 END) as live')->first();

        $bySource = (clone $views)->selectRaw('source, count(*) as total')->groupBy('source')->pluck('total', 'source');
        $viewsBySource = [];
        foreach (ProfileViewSource::cases() as $source) {
            $viewsBySource[$source->value] = (int) ($bySource[$source->value] ?? 0);
        }
        // A view written before its source was recorded is one that came from nowhere we know: a direct one.
        $viewsBySource[ProfileViewSource::Direct->value] += (int) ($bySource[''] ?? 0);

        return [
            'role' => 'pet',
            'pet_status' => $pet->getStatusEnum()->value,
            'tiles' => [
                'views' => $viewCounts,
                'bookmarks' => $bookmarkCounts,
                'requests' => ['total' => (int) $requestCounts->sum(), 'open' => (int) $requestCounts->only(AdoptionRequest::OPEN_STATUSES)->sum()],
                // A Hired pet has no live invites (Invite::active()); the total stays its history.
                'invites' => ['total' => (int) $inviteCounts->total, 'live' => $pet->getStatusEnum() === PetStatus::AdoptedHired ? 0 : (int) $inviteCounts->live],
            ],
            'views_over_time' => $this->viewsPerDay($pet),
            'views_by_source' => $viewsBySource,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function forHuman(User $user, HomeProfile $home): array
    {
        // The pets Pets for You lists (MatchController): a score is kept only for a pair that passes every
        // dealbreaker, and a pet that is no longer Looking for a Home, or whose account isn't Active, isn't a match.
        $scores = MatchScore::query()
            ->where('home_profile_id', $home->id)
            ->whereHas('pet', fn (Builder $pet) => $pet
                ->where('status', PetStatus::LookingForAHome->value)
                ->whereHas('user', fn (Builder $owner) => $owner->where('status', AccountStatus::Active->value)))
            ->selectRaw('score, count(*) as total')->groupBy('score')->pluck('total', 'score');

        $requests = AdoptionRequest::query()->where('home_profile_id', $home->id);
        $byStatus = (clone $requests)->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status');
        $outcomes = [];
        foreach (AdoptionRequestStatus::cases() as $status) {
            $outcomes[$status->value] = (int) ($byStatus[$status->value] ?? 0);
        }

        // The human has the next step: answer a new request, confirm a booked Meet & Greet, or choose after it.
        $needAction = (clone $requests)->where(function (Builder $query): void {
            $query->whereIn('status', [AdoptionRequestStatus::Sent->value, AdoptionRequestStatus::AwaitingDecision->value])
                ->orWhere(fn (Builder $approved) => $approved
                    ->where('status', AdoptionRequestStatus::Approved->value)
                    ->whereHas('meetAndGreets', fn (Builder $meeting) => $meeting->where('status', MeetAndGreetStatus::Booked->value)));
        })->count();

        $adoptions = Adoption::query()->active()->where('home_profile_id', $home->id);

        return [
            'role' => 'human',
            'has_completed_quiz' => $home->hasCompletedQuiz(),
            'tiles' => [
                'matches' => ['total' => (int) $scores->sum(), 'strong' => (int) $scores->filter(fn ($count, $score) => $score >= self::STRONG_MATCH)->sum()],
                'bookmarks' => ['total' => Bookmark::query()->where('user_id', $user->id)->whereNotNull('pet_id')->count()],
                'requests' => ['total' => array_sum($outcomes), 'need_action' => $needAction],
                'adopted' => [
                    'total' => (clone $adoptions)->count(),
                    'names' => (clone $adoptions)->with('pet')->orderByDesc('adopted_at')->limit(self::ADOPTED_NAMES)->get()
                        ->map(fn (Adoption $adoption) => $adoption->pet?->name)->filter()->values()->all(),
                ],
            ],
            'match_score_distribution' => array_map(fn (array $band) => [
                'from' => $band[0],
                'to' => $band[1],
                'count' => (int) $scores->filter(fn ($count, $score) => $score >= $band[0] && $score <= $band[1])->sum(),
            ], self::SCORE_BANDS),
            'request_outcomes' => $outcomes,
        ];
    }

    /**
     * Views of the resume on each of the last 30 days, oldest first. A day is a day in the Philippines, as the
     * screens write dates, so "today" on the chart is the reader's today.
     *
     * @return list<array{date: string, count: int}>
     */
    private function viewsPerDay(Pet $pet): array
    {
        $today = Carbon::now(PhilippineTime::TIME_ZONE)->startOfDay();
        $first = $today->copy()->subDays(self::VIEW_DAYS - 1);

        $query = ProfileView::query()
            ->where('pet_id', $pet->id)
            ->where('created_at', '>=', $first->copy()->utc());

        // Laravel stores naive UTC timestamps. Convert to Manila before grouping.
        // Keep the existing portable behavior for other local database drivers.
        $perDay = $query->getConnection()->getDriverName() === 'pgsql'
            ? $query->selectRaw("DATE(created_at + INTERVAL '8 hours') as day, count(*) as total")
                ->groupByRaw("DATE(created_at + INTERVAL '8 hours')")->pluck('total', 'day')
            : $query->pluck('created_at')
                ->countBy(fn ($at) => Carbon::parse($at)->setTimezone(PhilippineTime::TIME_ZONE)->format('Y-m-d'));

        $days = [];
        for ($day = $first->copy(); $day->lte($today); $day->addDay()) {
            $date = $day->format('Y-m-d');
            $days[] = ['date' => $date, 'count' => (int) ($perDay[$date] ?? 0)];
        }

        return $days;
    }

    private function recentCounts(Builder $query, Carbon $recent): array
    {
        $counts = (clone $query)->selectRaw('count(*) as total, count(CASE WHEN created_at >= ? THEN 1 END) as this_week', [$recent])->first();

        return ['total' => (int) $counts->total, 'this_week' => (int) $counts->this_week];
    }
}
