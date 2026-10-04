<?php

declare(strict_types=1);

namespace App\Services\Auth;

use App\Enums\AccountStatus;
use App\Enums\Role;
use App\Enums\VerificationSubmissionStatus;
use App\Exceptions\VerificationAlreadyReviewed;
use App\Models\User;
use App\Models\VerificationSubmission;
use Illuminate\Database\Eloquent\Builder;

/**
 * The admin's verification queue (BE-08, AU-22..AU-24): each waiting account's latest submission, oldest first.
 *
 * An owner who edits their details adds a new submission row, so an account can have several; only the latest one
 * counts, and the queue has one row per account (docs/api/auth.md).
 */
class VerificationQueue
{
    /** Escapes the wildcards of a LIKE pattern, so a search for "50%" finds "50%". */
    private const LIKE_ESCAPE = '!';

    /**
     * Latest submissions that are still pending, of pet and human accounts still Pending Verification.
     *
     * @return Builder<VerificationSubmission>
     */
    public function waiting(): Builder
    {
        return VerificationSubmission::query()
            ->where('status', VerificationSubmissionStatus::Pending->value)
            ->whereIn('id', VerificationSubmission::query()->selectRaw('max(id)')->groupBy('user_id'))
            ->whereHas('user', fn (Builder $user) => $user
                ->whereIn('role', [Role::Pet->value, Role::Human->value])
                ->where('status', AccountStatus::PendingVerification->value));
    }

    /**
     * The queue as AU-22 lists it: oldest first, narrowed by account type and by part of a name.
     *
     * @return Builder<VerificationSubmission>
     */
    public function listing(?string $role, ?string $search): Builder
    {
        $query = $this->waiting();

        if ($role !== null) {
            $query->whereHas('user', fn (Builder $user) => $user->where('role', $role));
        }

        if ($search !== null && $search !== '') {
            $like = '%'.$this->escapeLike(mb_strtolower($search)).'%';
            $matches = fn (Builder $q, string $column) => $q->whereRaw("LOWER({$column}) LIKE ? ESCAPE ?", [$like, self::LIKE_ESCAPE]);

            $query->whereHas('user', fn (Builder $user) => $user->where(fn (Builder $names) => $names
                ->whereHas('pet', fn (Builder $pet) => $pet->where(fn (Builder $q) => $matches($q, 'name')->orWhere(fn (Builder $or) => $matches($or, 'caretaker_name'))))
                ->orWhereHas('homeProfile', fn (Builder $home) => $matches($home, 'full_name'))));
        }

        // How many rows the account sent before this one: more than none makes it a resubmission.
        $earlier = VerificationSubmission::query()
            ->from('verification_submissions as earlier')
            ->selectRaw('count(*)')
            ->whereColumn('earlier.user_id', 'verification_submissions.user_id')
            ->whereColumn('earlier.id', '<', 'verification_submissions.id');

        return $query
            ->select('verification_submissions.*')
            ->selectSub($earlier, 'earlier_submissions_count')
            ->orderBy('submitted_at')
            ->orderBy('id');
    }

    /**
     * The latest submission of a pet or human account. Null for an id that doesn't exist, an admin's id, or an
     * account that never submitted: all three answer 404 (SEC-AUTHZ-04).
     */
    public function latestFor(int $accountId): ?VerificationSubmission
    {
        return VerificationSubmission::query()
            ->where('user_id', $accountId)
            ->whereHas('user', fn (Builder $user) => $user->whereIn('role', [Role::Pet->value, Role::Human->value]))
            ->orderByDesc('id')
            ->first();
    }

    /**
     * Where a submission stands among those waiting, and which account to review next.
     *
     * @return array{position: int|null, total: int, next_account_id: int|null}
     */
    public function positionOf(VerificationSubmission $submission): array
    {
        $isWaiting = $this->waiting()->whereKey($submission->id)->exists();

        $before = fn (Builder $q) => $q
            ->where('submitted_at', '<', $submission->submitted_at)
            ->orWhere(fn (Builder $same) => $same->where('submitted_at', $submission->submitted_at)->where('id', '<', $submission->id));
        $after = fn (Builder $q) => $q
            ->where('submitted_at', '>', $submission->submitted_at)
            ->orWhere(fn (Builder $same) => $same->where('submitted_at', $submission->submitted_at)->where('id', '>', $submission->id));

        $others = fn (): Builder => $this->waiting()->whereKeyNot($submission->id)->orderBy('submitted_at')->orderBy('id');

        // The account submitted next after this one, or the oldest when this is the newest. A decided account sits
        // where its time puts it.
        $next = $others()->where($after)->first() ?? $others()->first();

        return [
            'position' => $isWaiting ? $this->waiting()->where($before)->count() + 1 : null,
            'total' => $this->waiting()->count(),
            'next_account_id' => $next?->user_id,
        ];
    }

    /**
     * The account's latest submission, locked for a decision. Call inside a transaction: the account row is locked
     * first, so two admins can't both decide it (SEC-AUTHZ-08).
     *
     * @throws VerificationAlreadyReviewed when it is no longer waiting for a decision
     */
    public function lockForDecision(int $accountId): VerificationSubmission
    {
        $account = User::query()->whereKey($accountId)->lockForUpdate()->firstOrFail();
        $submission = $account->verificationSubmissions()->orderByDesc('id')->lockForUpdate()->firstOrFail();

        if ($submission->status !== VerificationSubmissionStatus::Pending->value) {
            throw VerificationAlreadyReviewed::decided($submission);
        }

        if (! $account->isPendingVerification()) {
            throw VerificationAlreadyReviewed::noLongerWaiting();
        }

        return $submission->setRelation('user', $account);
    }

    private function escapeLike(string $value): string
    {
        return str_replace(
            [self::LIKE_ESCAPE, '%', '_'],
            [self::LIKE_ESCAPE.self::LIKE_ESCAPE, self::LIKE_ESCAPE.'%', self::LIKE_ESCAPE.'_'],
            $value,
        );
    }
}
