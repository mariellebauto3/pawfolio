<?php

namespace App\Providers;

use App\Http\Resources\ErrorResource;
use App\Http\Resources\ResponseResource;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Http\Request;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\ValidationException;

class AppServiceProvider extends ServiceProvider
{
    /**
     * The cache repository implementation.
     */
    protected $cache;

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

        // Error format (docs/api/README.md): every 4xx error is JSON
        // `{ "message": string, "code"?: string, "errors"?: { field: string[] } }`.
        // See project-rules/security-guidelines.md §7.1 (SEC-API-02).
        $this->handleErrorResponses();
    }

    /**
     * Configure the API rate limiters.
     *
     * @return void
     */
    protected function configureRateLimiting(): void
    {
        $limiter = $this->app->make('Illuminate\Cache\RateLimiter');

        $limiter->for('api', function (Request $request) {
            return $request->input('rate_limit') ? 
                $limiter->limit($request->input('rate_limit'), 60) : 
                $limiter->limit(60);
        });

        // Sign-in: SEC-AUTH-04 rate-limits per account + IP so a single client
        // cannot brute-force credentials (T01, AU-03). 5 attempts per 15 minutes
        // per IP. This mirrors the cache-backed lockout the SignIn action
        // maintains (see also SEC-AUTH-05: one generic error surface).
        $limiter->for('sign-in', function (Request $request) {
            return Limit::perMinute(env('RATE_LIMIT_SIGN_IN_MAX_ATTEMPTS', 5), env('RATE_LIMIT_SIGN_IN_DECAY_MINUTES', 15))
                ->by($request->ip());
        });
    }

    /**
     * Register global error formatters so every 4xx/5xx response is JSON
     * with the standard `{ "message", "code"?, "errors"? }` body.
     *
     * @return void
     */
    protected function handleErrorResponses(): void
    {
        $this->app->singleton(
            \Illuminate\Contracts\Debug\ExceptionHandler::class,
            \App\Exceptions\Handler::class,
        );
    }
}
