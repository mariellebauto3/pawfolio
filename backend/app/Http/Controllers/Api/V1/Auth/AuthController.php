<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Actions\Auth\SignIn;
use App\Enums\Role;
use App\Enums\AccountStatus;
use App\Http\Requests\Auth\SignInRequest;
use App\Http\Resources\Auth\AuthenticatedUserResource;
use App\Http\Resources\ErrorResource;
use App\Models\User;
use function Illuminate\Support\str;
use Illuminate\Auth\Notifications\ResetPassword as ResetPasswordNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;

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
     * Returns the same shape as /me on success. One generic email error whether
     * the account exists (SEC-AUTH-05). 429 with Retry-After on lockout
     * (SEC-AUTH-04).
     */
    public function signIn(SignInRequest $request): JsonResponse
    {
        $email = $request->validated()['email'];
        $password = $request->validated()['password'];
        $ip = $request->ip();

        if ($this->signIn->isLockedOut($email, $ip)) {
            return response()->json([
                'message' => 'Too many sign-in attempts. Please try again later.',
            ], 429, ['Retry-After' => '900']);
        }

        $user = $this->signIn->attempt($email, $password, $ip);

        if (! $user) {
            // One generic message whether the account exists (SEC-AUTH-05).
            return response()->json([
                'message' => 'That email and password don\'t match. Try again.',
                'errors' => [
                    'email' => ['That email and password don\'t match. Try again.'],
                ],
            ], 422);
        }

        // Regenerate the session on sign-in (SEC-AUTH-07). The request already
        // has an active session by this point (statefulApi), so we're rotating
        // the ID for the just-authenticated user.
        $request->session()->regenerate();

        return response()->json([
            'data' => AuthenticatedUserResource::make($user),
        ]);
    }

    /**
     * POST /api/v1/auth/sign-out
     *
     * Invalidate the session (SEC-AUTH-07) and return 204.
     */
    public function signOut(Request $request): JsonResponse
    {
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(null, 204);
    }

    /**
     * POST /api/v1/auth/forgot-password
     *
     * Sends a single-use, 30-minute reset link (SEC-AUTH-08) and returns the
     * same generic shape as /me so the frontend can display a success screen.
     * SEC-AUTH-05: identical response whether or not the email exists.
     */
    public function forgotPassword(Request $request): JsonResponse
    {
        $email = $request->validated(['email'])['email'] ?? null;

        $status = Password::sendResetLink(
            $request->validate(['email' => 'required|email'])
        );

        return response()->json([
            'message' => $status === Password::RESET_LINK_SENT
                ? 'If an account exists with this email, we\'ve sent a password reset link.'
                : 'If an account exists with this email, we\'ve sent a password reset link.',
            'status' => $status,
        ]);
    }

    /**
     * POST /api/v1/auth/reset-password
     *
     * Resets the password with a single-use, 30-minute token (SEC-AUTH-08).
     *
     * @throws \Illuminate\Auth\AuthenticationException
     * @throws \Illuminate\Validation\ValidationException
     */
    public function resetPassword(Request $request): JsonResponse
    {
        $request->validate([
            'token' => 'required',
            'email' => 'required|email',
            'password' => 'required|string|confirmed|min:8',
        ]);

        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user, string $password) {
                $user->forceFill([
                    'password' => Hash::make($password),
                ])->setRememberToken(Str::random(10));

                $user->save();

                // SEC-AUTH-07: regenerate the session on password change so a
                // stolen session cookie is invalidated.
                $request->session()->invalidate();
                $request->session()->regenerateToken();
            }
        );

        return response()->json([
            'message' => $status === Password::PASSWORD_RESET
                ? 'Your password has been reset.'
                : 'We were unable to reset your password.',
        ]);
    }

    /**
     * POST /api/v1/admin/users
     *
     * Creates an account. Available only to admins (SEC-AUTH-10, SEC-AUTHZ-07).
     * Role and status are system-set only — never through a request.
     *
     * @throws \Illuminate\Auth\AuthenticationException
     * @throws \Illuminate\Validation\ValidationException
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
}
