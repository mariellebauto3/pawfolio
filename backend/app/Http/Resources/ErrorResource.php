<?php

namespace App\Http\Resources;

use Illuminate\Contracts\Support\Responsable;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

/**
 * Standard error body: `{ "message": string, "code"?: string, "errors"?: { field: string[] } }`
 *
 * Matches docs/api/README.md. Used for 4xx responses as the single source of truth
 * for what the frontend receives. See project-rules/security-guidelines.md §7.1 (SEC-API-02).
 */
class ErrorResource implements Responsable
{
    public const CODE_UNAUTHENTICATED = 'unauthenticated';
    public const CODE_FORBIDDEN = 'forbidden';
    public const CODE_NOT_FOUND = 'not_found';
    public const CODE_CONFLICT = 'conflict';
    public const CODE_VALIDATION = 'validation';
    public const CODE_PAYLOAD_TOO_LARGE = 'payload_too_large';
    public const CODE_RATE_LIMITED = 'rate_limited';
    public const CODE_BAD_REQUEST = 'bad_request';
    public const CODE_SERVER = 'server';
    public const CODE_ACCOUNT_NOT_ACTIVE = 'account_not_active';

    public function __construct(
        public readonly string $message,
        public readonly ?string $code = null,
        public readonly array $errors = [],
    ) {
    }

    public static function unauthorized(string $message = 'Unauthenticated.'): self
    {
        return new self($message, self::CODE_UNAUTHENTICATED);
    }

    public static function forbidden(string $message = 'Forbidden.'): self
    {
        return new self($message, self::CODE_FORBIDDEN);
    }

    public static function notFound(string $message = 'Resource not found.'): self
    {
        return new self($message, self::CODE_NOT_FOUND);
    }

    public static function conflict(string $message = 'Conflict.'): self
    {
        return new self($message, self::CODE_CONFLICT);
    }

    public static function validation(ValidationException $e): self
    {
        return new self(
            $e->getMessage() ?: 'The given data was invalid.',
            self::CODE_VALIDATION,
            $e->errors(),
        );
    }

    public static function tooLarge(string $message = 'The uploaded file exceeds the maximum allowed size.'): self
    {
        return new self($message, self::CODE_PAYLOAD_TOO_LARGE);
    }

    public static function rateLimited(string $message = 'Too many requests. Please try again later.'): self
    {
        return new self($message, self::CODE_RATE_LIMITED);
    }

    public static function badRequest(string $message = 'Bad request.'): self
    {
        return new self($message, self::CODE_BAD_REQUEST);
    }

    public static function accountNotActive(string $message = 'Your account can\'t do this until it\'s active.'): self
    {
        return new self($message, self::CODE_ACCOUNT_NOT_ACTIVE);
    }

    public function toResponse($request): JsonResponse
    {
        $body = [
            'message' => $this->message,
        ];

        if ($this->code !== null) {
            $body['code'] = $this->code;
        }

        if ($this->errors !== []) {
            $body['errors'] = $this->errors;
        }

        // Log the error (without leaking internals to the client — SEC-API-02).
        if ($this->code === self::CODE_SERVER) {
            Log::error('Unhandled exception', ['exception' => $request->exception]);
        }

        return response()->json($body, $this->responseStatus());
    }

    private function responseStatus(): int
    {
        return match ($this->code) {
            self::CODE_UNAUTHENTICATED => 401,
            self::CODE_FORBIDDEN, self::CODE_ACCOUNT_NOT_ACTIVE => 403,
            self::CODE_NOT_FOUND => 404,
            self::CODE_BAD_REQUEST => 400,
            self::CODE_CONFLICT, self::CODE_RATE_LIMITED => 409,
            self::CODE_VALIDATION, self::CODE_PAYLOAD_TOO_LARGE => 422,
            self::CODE_SERVER => 500,
            default => 400,
        };
    }
}
