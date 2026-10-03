<?php

namespace App\Providers;

use App\Exceptions\Handler;
use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Contracts\Debug\ExceptionHandler;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureRateLimiting();
        $this->configurePasswordResetLinks();

        // Error format (docs/api/README.md): every 4xx error is JSON
        // `{ "message": string, "code"?: string, "errors"?: { field: string[] } }`.
        // See project-rules/security-guidelines.md §7.1 (SEC-API-02).
        $this->handleErrorResponses();
    }

    /**
     * Configure the API rate limiters.
     */
    protected function configureRateLimiting(): void
    {
        RateLimiter::for('api', function (Request $request) {
            return Limit::perMinute(60)->by($request->user()?->id ?: $request->ip());
        });

        // Sign-in flood guard per IP. The 5-strikes lockout per email + IP (SEC-AUTH-04, AU-03) lives in the
        // SignIn action and counts failures only; this limit counts every request, so it stays well above 5.
        RateLimiter::for('sign-in', function (Request $request) {
            return Limit::perMinute(20)->by($request->ip());
        });

        // SEC-AUTH-04: forgot-password and reset-password are rate-limited too, per IP.
        RateLimiter::for('forgot-password', function (Request $request) {
            return Limit::perMinutes(15, 5)->by($request->ip());
        });

        RateLimiter::for('reset-password', function (Request $request) {
            return Limit::perMinutes(15, 10)->by($request->ip());
        });
    }

    /**
     * The emailed reset link opens the frontend's AU-06 screen. Token and email go after "#", which browsers never
     * send to a server, so neither ends up in server logs or Referer headers (SEC-FE-04). The page reads them into
     * memory and clears the address bar.
     */
    protected function configurePasswordResetLinks(): void
    {
        ResetPassword::createUrlUsing(function (User $user, string $token): string {
            return rtrim((string) config('app.frontend_url'), '/').'/reset-password#'.http_build_query([
                'token' => $token,
                'email' => $user->getEmailForPasswordReset(),
            ]);
        });
    }

    /**
     * Register global error formatters so every 4xx/5xx response is JSON
     * with the standard `{ "message", "code"?, "errors"? }` body.
     */
    protected function handleErrorResponses(): void
    {
        $this->app->singleton(
            ExceptionHandler::class,
            Handler::class,
        );
    }
}
