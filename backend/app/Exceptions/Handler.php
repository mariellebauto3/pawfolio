<?php

namespace App\Exceptions;

use App\Http\Resources\ErrorResource;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Session\TokenMismatchException;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Symfony\Component\HttpKernel\Exception\MethodNotAllowedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\Exception\TooManyRequestsHttpException;
use Throwable;

class Handler extends ExceptionHandler
{
    /**
     * A list of the exception types that are not reported.
     *
     * @var array<int, class-string<Throwable>>
     */
    protected $dontReport = [
        // Authentication / authorization exceptions are converted to the standard
        // JSON body, so they are reported as 401/403 responses.
    ];

    /**
     * A list of the inputs that are never flashed to the session on validation
     * failures.
     *
     * @var array<int, string>
     */
    protected $dontFlash = [
        'current_password',
        'password',
        'password_confirmation',
    ];

    /**
     * Register the exception handling callbacks for the application.
     *
     * @return void
     */
    public function register()
    {
        $this->reportable(function (Throwable $e) {
            // Nothing to report here by default; all exceptions are routed to
            // the render() method below.
        });
    }

    /**
     * Render an exception into a JSON response.
     *
     * @param  Request  $request
     * @return JsonResponse
     */
    public function render($request, Throwable $e)
    {
        // 419 CSRF token missing/expired (SEC-AUTH-06). It stays 419, not 401: the frontend client refreshes the
        // token and retries once on 419 (docs/api/README.md), while a 401 would send the user to sign in.
        if ($e instanceof TokenMismatchException
            || ($e instanceof HttpException && $e->getStatusCode() === 419)) {
            return ErrorResource::sessionExpired()->toResponse($request);
        }

        // Unknown routes: 404 (SEC-AUTHZ-04 — missing or hidden records return 404).
        if ($e instanceof NotFoundHttpException) {
            return ErrorResource::notFound('Resource not found.')->toResponse($request);
        }

        // Unsupported method on a known route: 405.
        if ($e instanceof MethodNotAllowedHttpException) {
            return ErrorResource::badRequest('The request method is not supported for this route.')->toResponse($request);
        }

        // Rate-limited writes (SEC-API-04): 429 with Retry-After kept, so screens can say when to try again (AU-03).
        if ($e instanceof TooManyRequestsHttpException) {
            return ErrorResource::rateLimited('Too many attempts. Please wait a moment and try again.')
                ->withHeaders(array_change_key_case($e->getHeaders(), CASE_LOWER))
                ->toResponse($request);
        }

        // Validation failures: 422 with { message, errors }.
        if ($e instanceof ValidationException) {
            return ErrorResource::validation($e)->toResponse($request);
        }

        // Authorization failures: 403 (SEC-AUTHZ-06 — account not Active).
        if ($e instanceof AuthorizationException) {
            return ErrorResource::accountNotActive($e->getMessage())->toResponse($request);
        }

        // Authentication failures: 401 (SEC-AUTH-01).
        if ($e instanceof AuthenticationException) {
            return ErrorResource::unauthorized('Unauthenticated.')->toResponse($request);
        }

        // Other HTTP exceptions (403, 404, 405, etc.) mapped in the table in
        // docs/api/README.md.
        if ($e instanceof HttpException) {
            $statusCode = $e->getStatusCode();

            return match ($statusCode) {
                403 => ErrorResource::forbidden($e->getMessage())->toResponse($request),
                404 => ErrorResource::notFound($e->getMessage())->toResponse($request),
                405 => ErrorResource::badRequest('The request method is not supported for this route.')->toResponse($request),
                413 => ErrorResource::tooLarge($e->getMessage())->toResponse($request),
                429 => ErrorResource::rateLimited('Too many attempts. Please wait a moment and try again.')
                    ->withHeaders(array_change_key_case($e->getHeaders(), CASE_LOWER))
                    ->toResponse($request),
                default => ErrorResource::badRequest($e->getMessage())->toResponse($request),
            };
        }

        // Unhandled exceptions: 500, never leak internals (SEC-API-02).
        if ($this->shouldReport($e)) {
            throw $e;
        }

        return parent::render($request, $e);
    }
}
