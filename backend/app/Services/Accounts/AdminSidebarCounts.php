<?php

declare(strict_types=1);

namespace App\Services\Accounts;

use App\Enums\AdminSection;
use App\Enums\ReportStatus;
use App\Models\AdminSectionView;
use App\Models\AdoptionRequest;
use App\Models\Report;
use App\Models\User;
use App\Services\Auth\VerificationQueue;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;

/**
 * The counts beside the admin sidebar's links (GN-01). Each one is news for the admin who reads it: what arrived in
 * that section since they last opened it. Opening the section clears its count, and it comes back only when
 * something new arrives. The size of each queue is still on the dashboard and on the section's own page.
 *
 * Every admin has their own "last opened" time, so one admin looking doesn't clear another's count.
 */
class AdminSidebarCounts
{
    public function __construct(
        private readonly VerificationQueue $verification,
    ) {}

    /**
     * @return array<string, int> by section: `verification`, `reports`, `requests`
     */
    public function for(User $admin): array
    {
        $seen = AdminSectionView::query()->where('user_id', $admin->id)->get()->keyBy(fn (AdminSectionView $view) => $view->section->value);
        $since = fn (AdminSection $section): ?CarbonInterface => $seen->get($section->value)?->seen_at;

        return [
            AdminSection::Verification->value => $this->verification->newSince($since(AdminSection::Verification)),
            AdminSection::Reports->value => $this->reportsSince($since(AdminSection::Reports)),
            AdminSection::Requests->value => $this->overdueSince($since(AdminSection::Requests)),
        ];
    }

    /** The admin has the section open: its count starts again from now. */
    public function markSeen(User $admin, AdminSection $section): void
    {
        $view = AdminSectionView::query()->where('user_id', $admin->id)->where('section', $section->value)->first() ?? new AdminSectionView;
        $view->user_id = $admin->id;
        $view->section = $section;
        $view->seen_at = now();
        $view->save();
    }

    /** Reported items that are open and whose latest report was filed since then (RP-03 lists one row per item). */
    private function reportsSince(?CarbonInterface $seenAt): int
    {
        return Report::query()
            ->where('status', ReportStatus::Open->value)
            ->latestPerItem()
            ->when($seenAt !== null, fn (Builder $q) => $q->where('created_at', '>', $seenAt))
            ->count();
    }

    /**
     * Requests overdue for a decision (MG-16) that became overdue since then: flagged by the scheduled job after
     * that moment, or, when the job hasn't flagged it yet, 7 days past its meeting time after that moment.
     */
    private function overdueSince(?CarbonInterface $seenAt): int
    {
        return AdoptionRequest::query()
            ->overdue()
            ->when($seenAt !== null, fn (Builder $q) => $q->where(fn (Builder $became) => $became
                ->where('overdue_flagged_at', '>', $seenAt)
                ->orWhere(fn (Builder $unflagged) => $unflagged
                    ->whereNull('overdue_flagged_at')
                    ->where('awaiting_decision_at', '>', $seenAt->copy()->subDays(AdoptionRequest::OVERDUE_AFTER_DAYS)))))
            ->count();
    }
}
