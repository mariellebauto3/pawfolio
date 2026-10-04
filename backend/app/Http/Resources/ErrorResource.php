<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Standard error response resource (backend-guidelines §2).
 *
 * Usage:
 *   return ErrorResource::forbidden('You must be verified to perform this action.');
 *   return ErrorResource::conflict('You already have 3 open adoption requests.', 'open_request_limit');
 */
class ErrorResource extends JsonResource
{
    public static $wrap = null;

    protected int $statusCode = 400;

    protected ?string $errorCode = null;

    protected array $errors = [];

    public function __construct(
        string $message,
        int $statusCode = 400,
        ?string $errorCode = null,
        array $errors = []
    ) {
        parent::__construct(['message' => $message]);
        $this->statusCode = $statusCode;
        $this->errorCode = $errorCode;
        $this->errors = $errors;
    }

    public function toArray(Request $request): array
    {
        $payload = [
            'message' => $this->resource['message'],
        ];

        if ($this->errorCode !== null) {
            $payload['code'] = $this->errorCode;
        }

        if (! empty($this->errors)) {
            $payload['errors'] = $this->errors;
        }

        return $payload;
    }

    public function withResponse(Request $request, $response): void
    {
        $response->setStatusCode($this->statusCode);
    }

    public static function unauthenticated(string $message = 'Unauthenticated.'): self
    {
        return new self($message, 401, 'unauthenticated');
    }

    public static function forbidden(string $message = 'This action is unauthorized.', ?string $code = null): self
    {
        return new self($message, 403, $code);
    }

    public static function accountNotActive(string $message = 'Your account is not active.'): self
    {
        return new self($message, 403, 'account_not_active');
    }

    public static function notFound(string $message = 'Not found.'): self
    {
        return new self($message, 404, 'not_found');
    }

    public static function conflict(string $message, string $code): self
    {
        return new self($message, 409, $code);
    }

    public static function unprocessable(string $message, array $errors = []): self
    {
        return new self($message, 422, 'validation_failed', $errors);
    }

    public static function sessionExpired(string $message = 'Your session expired. Refresh and try again.'): self
    {
        return new self($message, 419, 'session_expired');
    }

    public static function rateLimited(int $retryAfter = 60): self
    {
        return new self(
            'Too many attempts. Please wait before trying again.',
            429,
            'rate_limited',
            ['retry_after' => $retryAfter]
        );
    }

    public static function serverError(string $message = 'Something went wrong. Please try again.'): self
    {
        return new self($message, 500, 'server');
    }
}
