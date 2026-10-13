<?php

namespace App\Actions\Auth;

use App\Enums\AccountStatus;
use App\Enums\ActivityLogType;
use App\Models\User;
use App\Services\ActivityLogs\ActivityLogger;
use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

/**
 * Signs a user in and handles the 5-attempt, 15-minute lockout (AU-02, AU-03; SEC-AUTH-02, -03, -06, -09).
 */
class SignIn
{
    private const MAX_ATTEMPTS = 5;

    private const LOCKOUT_SECONDS = 900;

    private const BAD_CREDENTIALS = "That email and password don't match. Try again.";

    private const CLOSED_ACCOUNT = 'This account was closed.';

    public function __construct(private readonly Cache $cache) {}

    public function __invoke(Request $request, string $email, string $password, bool $remember = false): User
    {
        $normalized = strtolower(trim($email));
        $key = 'sign-in:'.sha1($normalized.'|'.$request->ip());

        $until = (int) $this->cache->get("$key:until", 0);
        if ($until > time()) {
            throw new ThrottleRequestsException(headers: ['Retry-After' => max(1, $until - time())]);
        }

        $user = User::whereRaw('LOWER(email) = ?', [$normalized])
            ->first(['id', 'name', 'email', 'password', 'role', 'status', 'remember_token']);
        // A valid bcrypt hash at the production default cost; unknown accounts
        // perform the same password verification work without creating a hash.
        $dummyHash = '$2y$12$rIk0EBy.pUHusrTjk9YuI.fNfzEiqs9cT4AEkFMjbKF4tHHHEKObu';
        $dummyHash = substr_replace($dummyHash, sprintf('%02d', (int) config('hashing.bcrypt.rounds', 12)), 4, 2);
        $valid = $user ? Hash::check($password, $user->password) : password_verify($password, $dummyHash);
        $lock = $this->cache->lock("$key:lock", 30);
        if (! $lock->get()) {
            throw new ThrottleRequestsException(headers: ['Retry-After' => 1]);
        }
        try {
            $until = (int) $this->cache->get("$key:until", 0);
            if ($until > time()) {
                throw new ThrottleRequestsException(headers: ['Retry-After' => max(1, $until - time())]);
            }

            if (! $user || ! $valid) {
                $tries = (int) $this->cache->get("$key:tries", 0) + 1;
                $this->cache->put("$key:tries", $tries, self::LOCKOUT_SECONDS);
                if ($tries >= self::MAX_ATTEMPTS) {
                    $this->cache->put("$key:until", time() + self::LOCKOUT_SECONDS, self::LOCKOUT_SECONDS);
                }
            } else {
                $this->cache->forget("$key:tries");
                $this->cache->forget("$key:until");
            }
        } finally {
            $lock->release();
        }
        if (! $user || ! $valid) {
            $this->log($request, $user, 'sign_in_failed');
            throw ValidationException::withMessages(['email' => [self::BAD_CREDENTIALS]]);
        }

        // Deactivated accounts are told only after the right password, so email probing learns nothing (SEC-AUTH-03).
        if ($user->getStatus() === AccountStatus::Deactivated) {
            $this->log($request, $user, 'sign_in_refused_deactivated');

            throw ValidationException::withMessages(['email' => [self::CLOSED_ACCOUNT]]);
        }

        Auth::guard('web')->login($user, $remember);

        if ($request->hasSession()) {
            // SessionGuard::login already migrates/destroys the old session ID.
            // Rotate CSRF without migrating the same session a second time.
            $request->session()->regenerateToken();
        }

        $this->log($request, $user, 'signed_in');

        return $user;
    }

    private function log(Request $request, ?User $user, string $action): void
    {
        ActivityLogger::log(
            type: ActivityLogType::Security,
            action: $action,
            actor: $user,
            subject: $user,
            userAgent: $request->userAgent(),
        );
    }
}
