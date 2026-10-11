<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Actions\Auth\SignIn;
use App\Enums\ActivityLogType;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ForgotPasswordRequest;
use App\Http\Requests\Auth\ResetPasswordRequest;
use App\Http\Requests\Auth\SignInRequest;
use App\Http\Resources\Auth\AuthenticatedUserResource;
use App\Http\Resources\ErrorResource;
use App\Models\User;
use App\Services\ActivityLogs\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Authentication endpoints for the v1 API (BE-03, docs/api/auth.md).
 */
class AuthController extends Controller
{
    private const FORGOT_PASSWORD_ANSWER = "If an account exists for that email, we've sent a link to reset the password. It expires in 30 minutes.";

    private const RESET_PASSWORD_ANSWER = 'Your password has been reset. Sign in with your new password.';

    private const BAD_RESET_LINK = 'This reset link is invalid or has expired. Ask for a new one.';

    private const ALREADY_SIGNED_IN = 'This browser is already signed in to an account. Log out of it before signing in to another one.';

    public const ALREADY_SIGNED_IN_CODE = 'already_signed_in';

    public function signIn(SignInRequest $request, SignIn $signIn): AuthenticatedUserResource|JsonResponse
    {
        // One account per browser session: a session that is signed in is never handed to another account. It is
        // refused before the email and password are looked at, so the answer says nothing about them (SEC-AUTH-05).
        $current = Auth::guard('web')->user();
        if ($current instanceof User) {
            ActivityLogger::log(
                type: ActivityLogType::Security,
                action: 'sign_in_refused_already_signed_in',
                actor: $current,
                subject: $current,
                userAgent: $request->userAgent(),
            );

            return ErrorResource::conflict(self::ALREADY_SIGNED_IN, self::ALREADY_SIGNED_IN_CODE)->toResponse($request);
        }

        $user = $signIn(
            $request,
            $request->string('email')->toString(),
            $request->string('password')->toString(),
            $request->boolean('remember'),
        );

        return new AuthenticatedUserResource($user->load(['pet', 'homeProfile']));
    }

    public function signOut(Request $request): Response
    {
        Auth::guard('web')->logout();

        if ($request->hasSession()) {
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        return response()->noContent();
    }

    public function me(Request $request): AuthenticatedUserResource
    {
        $user = $request->user()->load(['pet', 'homeProfile']);

        return new AuthenticatedUserResource($user);
    }

    public function forgotPassword(ForgotPasswordRequest $request): JsonResponse
    {
        $email = strtolower(trim($request->string('email')->toString()));
        $startedAt = hrtime(true);

        if (User::whereRaw('LOWER(email) = ?', [$email])->exists()) {
            Password::broker()->sendResetLink(['email' => $email]);
        } else {
            Hash::make('pawfolio-password-reset-timing-equalizer');
        }

        $elapsedUs = (int) ((hrtime(true) - $startedAt) / 1000);
        if ($elapsedUs < 200_000) {
            usleep(200_000 - $elapsedUs);
        }

        return response()->json(['message' => self::FORGOT_PASSWORD_ANSWER]);
    }

    public function resetPassword(ResetPasswordRequest $request): JsonResponse
    {
        $credentials = [
            'email' => strtolower(trim($request->string('email')->toString())),
            'password' => $request->string('password')->toString(),
            'password_confirmation' => $request->string('password_confirmation')->toString(),
            'token' => $request->string('token')->toString(),
        ];

        $status = Password::broker()->reset(
            $credentials,
            function (User $user, string $password) use ($request): void {
                $user->forceFill([
                    'password' => Hash::make($password),
                    'remember_token' => Str::random(60),
                ])->save();

                Auth::guard('web')->logout();
                if ($request->hasSession()) {
                    $request->session()->invalidate();
                    $request->session()->regenerateToken();
                }
                DB::table(config('session.table', 'sessions'))->where('user_id', $user->id)->delete();
                $user->tokens()->delete();

                ActivityLogger::log(
                    type: ActivityLogType::Security,
                    action: 'password_reset',
                    actor: $user,
                    subject: $user,
                    userAgent: $request->userAgent(),
                );
            },
        );

        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages(['token' => [self::BAD_RESET_LINK]]);
        }

        return response()->json(['message' => self::RESET_PASSWORD_ANSWER]);
    }
}
