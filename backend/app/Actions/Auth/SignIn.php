<?php

namespace App\Actions\Auth;

use Illuminate\Cache\Repository as CacheStore;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;

/**
 * Sign-in action (SEC-AUTH-04, SEC-AUTH-05, SEC-AUTH-07).
 *
 * - 5 failed attempts per account + IP pauses sign-in for 15 minutes (SEC-AUTH-04).
 * - On failure the caller gets one generic message whether the account exists (SEC-AUTH-05).
 * - On success the session ID is regenerated (SEC-AUTH-07) and the authenticated user is returned.
 *
 * Attempt counters live in a cache store (default: the app's cache, CACHE_STORE in
 * .env). The store is injected so tests can use an in-memory array store without
 * depending on the global cache binding.
 */
class SignIn
{
    private const MAX_ATTEMPTS = 5;
    private const LOCKOUT_SECONDS = 15 * 60;

    public function __construct(
        private readonly ?CacheStore $store = null,
    ) {}

    /**
     * Convenience for production wiring: use the app cache when no store is injected.
     * Made public so tests can swap in an isolated store.
     */
    public function store(): CacheStore
    {
        return $this->store ?? Cache::store();
    }

    public function attempt(string $email, string $password, string $ip): ?User
    {
        $emailKey = $this->emailKey($email);
        $fails = (int) $this->store()->get($emailKey, 0);

        if ($fails >= self::MAX_ATTEMPTS) {
            $this->recordIpLockout($ip);

            return null;
        }

        $user = User::whereEmail($email)->first();

        if (! $user || ! Hash::check($password, $user->password)) {
            $this->recordFailure($emailKey, $ip, $user);

            return null;
        }

        $this->clearFailures($emailKey);
        $this->store()->forget("signin:account:{$user->id}");

        return $user;
    }

    private function recordFailure(string $emailKey, string $ip, ?User $user): void
    {
        $this->store()->add($emailKey, 1, self::LOCKOUT_SECONDS);
        $this->store()->increment($emailKey, 1, self::LOCKOUT_SECONDS);

        if ($user) {
            $this->store()->add("signin:account:{$user->id}", 1, self::LOCKOUT_SECONDS);
            $this->store()->increment("signin:account:{$user->id}", 1, self::LOCKOUT_SECONDS);
        }

        $this->recordIpLockout($ip);
    }

    private function recordIpLockout(string $ip): void
    {
        $this->store()->add("signin:ip:{$ip}", 1, self::LOCKOUT_SECONDS);
        $this->store()->increment("signin:ip:{$ip}", 1, self::LOCKOUT_SECONDS);
    }

    private function clearFailures(string $emailKey): void
    {
        $this->store()->forget($emailKey);
    }

    public function isLockedOut(string $email, string $ip): bool
    {
        $emailKey = $this->emailKey($email);

        return (int) $this->store()->get($emailKey, 0) >= self::MAX_ATTEMPTS
            || (int) $this->store()->get("signin:ip:{$ip}", 0) >= self::MAX_ATTEMPTS;
    }

    private function emailKey(string $email): string
    {
        // Hash the email so the cache key is not the raw address (defense in depth, not secret).
        return 'signin:email:' . sha1(strtolower($email));
    }
}
