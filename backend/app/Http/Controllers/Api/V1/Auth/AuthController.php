<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Actions\Auth\SignIn;
use App\Enums\AccountStatus;
use App\Http\Requests\Auth\ForgotPasswordRequest;
use App\Http\Requests\Auth\ResetPasswordRequest;
use App\Http\Requests\Auth\SignInRequest;
use App\Http\Resources\Auth\AuthenticatedUserResource;
use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController
{
    public function __construct(
        private readonly SignIn $signIn,
    ) {}

    /**
     * GET /api/v1/auth/me
     *
     * The signed-in account, whatever its status (docs/api/auth.md). Pending,
     * Denied and Suspended accounts need it to render their status screen, so
     * it is exempt from the Active-only middleware.
     */
    public function me(Request $request): AuthenticatedUserResource
    {
        $user = $request->user();

        // Always eager-load the pet and home profile so /me doesn't N+1 the
        // relationship the resource reads for display_name and profile_id.
        $user->loadMissing(['pet', 'homeProfile']);

        return AuthenticatedUserResource::make($user);
    }

    /**
     * POST /api/v1/auth/sign-in
     *
     * Logs the account in on the session guard and returns the same shape as /me (docs/api/auth.md). Pending,
     * Denied and Suspended accounts may sign in: the frontend sends them to their status screen (FR2, FR19).
     * One generic error whether the account exists (SEC-AUTH-05); "This account was closed." only after the right
     * password; 429 with Retry-After once an email + IP pair is locked out (SEC-AUTH-04).
     */
    public function signIn(SignInRequest $request): JsonResponse
    {
        ['email' => $email, 'password' => $password] = $request->validated();
        $ip = (string) $request->ip();

        if ($this->signIn->isLockedOut($email, $ip)) {
            return response()->json([
                'message' => 'Too many failed attempts. Sign-in is paused for 15 minutes.',
                'code' => 'rate_limited',
            ], 429, ['Retry-After' => (string) $this->signIn->secondsUntilUnlocked($email, $ip)]);
        }

        $user = $this->signIn->attempt($email, $password, $ip, $request->userAgent());

        if (! $user) {
            return $this->signInError("That email and password don't match. Try again.");
        }

        if ($user->status === AccountStatus::Deactivated) {
            // Deactivated accounts can't sign in (AU-03). Said only to someone who knows the password.
            return $this->signInError('This account was closed.');
        }

        Auth::guard('web')->login($user, $request->boolean('remember'));
        // A fresh session ID on sign-in (SEC-AUTH-07).
        $request->session()->regenerate();

        $user->loadMissing(['pet', 'homeProfile']);

        return response()->json(['data' => AuthenticatedUserResource::make($user)]);
    }

    /**
     * POST /api/v1/auth/sign-out
     *
     * Logs out, invalidates the session and rotates the CSRF token (SEC-AUTH-07). 204, also when already signed out.
     */
    public function signOut(Request $request): JsonResponse
    {
        Auth::guard('web')->logout();

        if ($request->hasSession()) {
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        return response()->json(null, 204);
    }

    /**
     * POST /api/v1/auth/forgot-password
     *
     * Emails a single-use, 30-minute reset link (SEC-AUTH-08) when the account exists. Always the same 200 answer,
     * whether it exists, doesn't, or asked too recently (SEC-AUTH-05, AU-05).
     */
    public function forgotPassword(ForgotPasswordRequest $request): JsonResponse
    {
        Password::sendResetLink($request->only('email'));

        return response()->json([
            'message' => "If an account exists for that email, we've sent a link to reset the password. It expires in 30 minutes.",
        ]);
    }

    /**
     * POST /api/v1/auth/reset-password
     *
     * Sets a new password with the emailed token (single use, 30 minutes, SEC-AUTH-08). Every session of the account
     * ends and its remember-me token is rotated, so other devices are signed out (SEC-AUTH-07). The visitor is not
     * signed in: AU-06 sends them to sign in with the new password.
     */
    public function resetPassword(ResetPasswordRequest $request): JsonResponse
    {
        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user, string $password) use ($request): void {
                $user->forceFill(['password' => Hash::make($password)])
                    ->setRememberToken(Str::random(60));
                $user->save();

                if (config('session.driver') === 'database') {
                    DB::table(config('session.table', 'sessions'))->where('user_id', $user->id)->delete();
                }

                ActivityLog::create([
                    'actor_user_id' => $user->id,
                    'type' => 'security',
                    'action' => 'password_reset',
                    'subject_type' => User::class,
                    'subject_id' => $user->id,
                    'user_agent' => $request->userAgent() !== null ? mb_substr($request->userAgent(), 0, 255) : null,
                ]);

                event(new PasswordReset($user));
            }
        );

        if ($status !== Password::PASSWORD_RESET) {
            // Invalid, used or expired token, or no such account: one message, nothing revealed (SEC-AUTH-05).
            $message = 'This reset link is invalid or has expired. Ask for a new one.';

            return response()->json([
                'message' => $message,
                'code' => 'validation',
                'errors' => ['token' => [$message]],
            ], 422);
        }

        return response()->json(['message' => 'Your password has been reset. Sign in with your new password.']);
    }

    /**
     * POST /api/v1/admin/users
     *
     * Creates an account. Available only to admins (SEC-AUTH-10, SEC-AUTHZ-07).
     * Role and status are system-set only — never through a request.
     *
     * @throws AuthenticationException
     * @throws ValidationException
     */
    public function createUser(Request $request): JsonResponse
    {
        $this->authorize('create', User::class);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:8|confirmed',
            'role' => 'required|in:pet,human,admin',
        ]);

        // SEC-INPUT-04/05: role/status are system-set only, never from the request.
        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'role' => $validated['role'],
            'status' => AccountStatus::Active,
        ]);

        return response()->json([
            'data' => AuthenticatedUserResource::make($user),
        ], 201);
    }

    private function signInError(string $message): JsonResponse
    {
        return response()->json([
            'message' => $message,
            'code' => 'validation',
            'errors' => ['email' => [$message]],
        ], 422);
    }
}
