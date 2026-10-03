<?php

namespace App\Actions\Auth;

use App\Enums\AccountStatus;
use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Contracts\Cache\Repository as CacheStore;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;

/**
 * Sign-in check (SEC-AUTH-04, SEC-AUTH-05, SEC-LOG-02). The controller logs the user in.
 *
 * - 5 failed attempts for one email from one IP pause sign-in for that pair for 15 minutes (SEC-AUTH-04, AU-03).
 *   Keyed on email + IP, so one shared IP (a school, an office) can't lock out everyone behind it.
 * - The caller gets one generic message whether the account exists (SEC-AUTH-05). A deactivated account is only
 *   told so after the right password, so the message reveals nothing to someone guessing.
 * - Successful, failed and locked-out attempts are written to activity_logs as `security` (SEC-LOG-02, LG-02),
 *   with the user agent and never the password.
 *
 * Attempt counters live in a cache store, injected so tests can use an isolated array store.
 */
class SignIn
{
    public const MAX_ATTEMPTS = 5;

    public const LOCKOUT_SECONDS = 15 * 60;

    public function __construct(
        private readonly ?CacheStore $store = null,
    ) {}

    public function store(): CacheStore
    {
        return $this->store ?? Cache::store();
    }

    public function isLockedOut(string $email, string $ip): bool
    {
        return (int) $this->store()->get($this->key($email, $ip), 0) >= self::MAX_ATTEMPTS;
    }

    /** Seconds until a locked-out pair may try again (for Retry-After). */
    public function secondsUntilUnlocked(string $email, string $ip): int
    {
        $lockedAt = (int) $this->store()->get($this->key($email, $ip).':at', 0);

        return max(1, $lockedAt + self::LOCKOUT_SECONDS - time());
    }

    /**
     * The user when the email and password match, otherwise null. A match on a deactivated account returns the
     * user too: the controller turns it away with "This account was closed."
     */
    public function attempt(string $email, string $password, string $ip, ?string $userAgent): ?User
    {
        $user = User::whereEmail($email)->first();

        if (! $user || ! Hash::check($password, $user->password)) {
            $this->recordFailure($email, $ip, $user, $userAgent);

            return null;
        }

        $this->store()->forget($this->key($email, $ip));
        $this->store()->forget($this->key($email, $ip).':at');

        $this->log($user, $user->status === AccountStatus::Deactivated ? 'sign_in_closed_account' : 'signed_in', $userAgent);

        return $user;
    }

    private function recordFailure(string $email, string $ip, ?User $user, ?string $userAgent): void
    {
        $key = $this->key($email, $ip);

        // add() only sets a missing key; otherwise count one more. (Doing both counted every failure twice.)
        if (! $this->store()->add($key, 1, self::LOCKOUT_SECONDS)) {
            $this->store()->increment($key);
        }

        $attempts = (int) $this->store()->get($key, 0);
        $lockedNow = $attempts === self::MAX_ATTEMPTS;
        if ($lockedNow) {
            $this->store()->put($key.':at', time(), self::LOCKOUT_SECONDS);
        }

        // Unknown emails are logged without the address, so the log can't be used to collect them.
        $this->log($user, $lockedNow ? 'sign_in_locked_out' : 'sign_in_failed', $userAgent);
    }

    private function log(?User $user, string $action, ?string $userAgent): void
    {
        ActivityLog::create([
            'actor_user_id' => $user?->id,
            'type' => 'security',
            'action' => $action,
            'subject_type' => $user ? User::class : null,
            'subject_id' => $user?->id,
            'user_agent' => $userAgent !== null ? mb_substr($userAgent, 0, 255) : null,
        ]);
    }

    private function key(string $email, string $ip): string
    {
        // Hash the email so the cache key isn't the raw address (defence in depth, not a secret).
        return 'signin:'.sha1(mb_strtolower(trim($email))).':'.$ip;
    }
}
