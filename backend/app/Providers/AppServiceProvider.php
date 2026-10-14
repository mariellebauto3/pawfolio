<?php

namespace App\Providers;

use App\Actions\Auth\SignIn;
use App\Exceptions\Handler;
use App\Mail\BrevoTransport;
use App\Models\User;
use App\Services\Auth\BreachedPasswordVerifier;
use App\Services\Auth\CaseInsensitiveUserProvider;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Contracts\Debug\ExceptionHandler;
use Illuminate\Contracts\Validation\UncompromisedVerifier;
use Illuminate\Http\Client\Factory as HttpFactory;
use Illuminate\Http\Request;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(UncompromisedVerifier::class, BreachedPasswordVerifier::class);
        $this->app->bind(SignIn::class, function ($app) {
            $store = $app->environment('production') ? config('auth.lockout_store') : config('cache.default');
            if ($app->environment('production')
                && ! in_array(config("cache.stores.$store.driver"), ['database', 'redis', 'memcached', 'dynamodb'], true)) {
                throw new \RuntimeException('AUTH_LOCKOUT_STORE must support shared atomic locks in production.');
            }

            return new SignIn($app['cache']->store($store));
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Auth::provider('case-insensitive-eloquent', fn ($app, array $config) => new CaseInsensitiveUserProvider($app['hash'], $config['model']));
        $this->configureRateLimiting();
        $this->configureBrevoMailer();
        $this->configurePasswordResetEmail();

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

        RateLimiter::for('signup', function (Request $request) {
            return Limit::perMinutes(15, 10)->by($request->ip());
        });

        RateLimiter::for('writes', function (Request $request) {
            return Limit::perMinute(60)->by($request->user()?->id ?: $request->ip());
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
     * Sends mail through Brevo's HTTPS API when MAIL_MAILER=brevo (ADR 0007). The key is read only when an email is
     * sent, so a missing key fails that email, not the boot.
     */
    protected function configureBrevoMailer(): void
    {
        Mail::extend('brevo', function (): BrevoTransport {
            $key = (string) config('services.brevo.key');
            if ($key === '') {
                throw new \RuntimeException('BREVO_API_KEY is not set.');
            }

            return new BrevoTransport($this->app->make(HttpFactory::class), $key);
        });
    }

    /**
     * The reset email (AU-05). Its link opens the frontend's AU-06 screen. Token and email go after "#", which
     * browsers never send to a server, so neither ends up in server logs or Referer headers (SEC-FE-04). The page
     * reads them into memory and clears the address bar.
     */
    protected function configurePasswordResetEmail(): void
    {
        ResetPassword::toMailUsing(function (User $user, string $token): MailMessage {
            $url = rtrim((string) config('app.frontend_url'), '/').'/reset-password#'.http_build_query([
                'token' => $token,
                'email' => $user->getEmailForPasswordReset(),
            ]);
            $minutes = (int) config('auth.passwords.'.config('auth.defaults.passwords').'.expire');

            return (new MailMessage)
                ->subject('Reset your Pawfolio password')
                ->greeting('Hi there,')
                ->line('We got a request to reset the password for your Pawfolio account.')
                ->action('Reset password', $url)
                ->line("This link works once and expires in {$minutes} minutes.")
                ->line("If you didn't ask for this, you can ignore this email. Your password stays the same.")
                ->salutation('The Pawfolio team');
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
