<?php

namespace App\Exceptions;

use App\Http\Resources\ErrorResource;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Request;
use Illuminate\Session\TokenMismatchException;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Throwable;

class Handler extends ExceptionHandler
{
    protected $dontReport = [
        AuthenticationException::class,
        AuthorizationException::class,
        ModelNotFoundException::class,
        ValidationException::class,
        ThrottleRequestsException::class,
    ];

    protected $dontFlash = [
        'current_password',
        'password',
        'password_confirmation',
    ];

    public function register(): void
    {
        $this->reportable(function (Throwable $e): void {
            //
        });
    }

    public function render($request, Throwable $e)
    {
        if ($request->is('api/*') || $request->expectsJson()) {
            return $this->renderApiException($request, $e);
        }

        return parent::render($request, $e);
    }

    protected function renderApiException(Request $request, Throwable $e)
    {
        // Validation errors: 422 with { message, errors } (backend-guidelines §2).
        if ($e instanceof ValidationException) {
            return response()->json([
                'message' => $e->getMessage(),
                'errors' => $e->errors(),
            ], 422);
        }

        // Unauthenticated: 401 (SEC-AUTHZ-01).
        if ($e instanceof AuthenticationException) {
            return ErrorResource::unauthenticated($e->getMessage())->toResponse($request);
        }

        // Expired CSRF token: 419 with code session_expired (docs/api/README.md).
        if ($e instanceof TokenMismatchException) {
            return ErrorResource::sessionExpired()->toResponse($request);
        }

        // Authorization failures: 404 when policy denies access to a specific resource (SEC-AUTHZ-04),
        // or 403 forbidden when the role/action itself is disallowed.
        if ($e instanceof AuthorizationException || $e instanceof AccessDeniedHttpException) {
            $previous = $e instanceof AccessDeniedHttpException ? $e->getPrevious() : null;
            $status = ($e instanceof AuthorizationException && $e->status() === 404)
                || ($previous instanceof AuthorizationException && $previous->status() === 404);

            if ($status) {
                return ErrorResource::notFound($e->getMessage() ?: 'Not found.')->toResponse($request);
            }

            return ErrorResource::forbidden(
                $e->getMessage() ?: 'You do not have permission to perform this action.',
            )->toResponse($request);
        }

        // Rate limit exceeded: 429 with Retry-After header (SEC-API-01).
        if ($e instanceof ThrottleRequestsException) {
            $retryAfter = (int) ($e->getHeaders()['Retry-After'] ?? 60);

            return ErrorResource::rateLimited($retryAfter)
                ->toResponse($request)
                ->header('Retry-After', (string) $retryAfter);
        }

        // Model not found or 404 HTTP exception: 404 (SEC-AUTHZ-04).
        if ($e instanceof ModelNotFoundException || $e instanceof NotFoundHttpException) {
            $message = ($e instanceof NotFoundHttpException && $e->getMessage() !== '')
                ? $e->getMessage()
                : 'Not found.';

            return ErrorResource::notFound($message)->toResponse($request);
        }

        // Generic HTTP exceptions with custom status codes (e.g. 409 Conflict).
        if ($e instanceof HttpExceptionInterface) {
            $status = $e->getStatusCode();

            return match ($status) {
                401 => ErrorResource::unauthenticated($e->getMessage() ?: 'Unauthenticated.')->toResponse($request),
                403 => ErrorResource::forbidden($e->getMessage() ?: 'Forbidden.')->toResponse($request),
                404 => ErrorResource::notFound($e->getMessage() ?: 'Not found.')->toResponse($request),
                409 => ErrorResource::conflict($e->getMessage() ?: 'Conflict.', 'conflict')->toResponse($request),
                419 => ErrorResource::sessionExpired()->toResponse($request),
                429 => ErrorResource::rateLimited((int) ($e->getHeaders()['Retry-After'] ?? 60))
                    ->toResponse($request)
                    ->header('Retry-After', (string) ($e->getHeaders()['Retry-After'] ?? 60)),
                default => ErrorResource::serverError()->toResponse($request)->setStatusCode($status),
            };
        }

        // Unhandled exceptions: report internally and return a safe 500 JSON body, never leaking internals (SEC-API-02).
        try {
            Log::error('Unhandled API exception', [
                'exception' => $e::class,
                'message' => $e->getMessage(),
            ]);
        } catch (Throwable) {
            // Ignore logging failures during error rendering.
        }

        return ErrorResource::serverError()->toResponse($request);
    }
}
