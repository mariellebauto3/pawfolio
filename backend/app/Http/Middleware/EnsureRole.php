<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Enums\ActivityLogType;
use App\Enums\Role;
use App\Http\Resources\ErrorResource;
use App\Services\ActivityLogs\ActivityLogger;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Checks the authenticated user's role on the server (SEC-AUTHZ-02, BE-06).
 *
 * Usage: ->middleware('role:admin') or ->middleware('role:pet,human')
 */
class EnsureRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (! $user) {
            return ErrorResource::unauthenticated()->toResponse($request);
        }

        $currentRole = $user->getRole()->value;
        $normalizedRoles = array_map(
            fn (string $r) => $r === 'furparent' ? Role::Human->value : $r,
            $roles,
        );

        if (! in_array($currentRole, $normalizedRoles, true)) {
            if ($normalizedRoles === [Role::Admin->value]) {
                // A pet or human asking for an admin endpoint is a security event (SEC-LOG-02).
                ActivityLogger::log(
                    type: ActivityLogType::Security,
                    action: 'admin_access_denied',
                    actor: $user,
                    subject: $user,
                    reason: $request->method().' /'.ltrim($request->path(), '/'),
                    userAgent: $request->userAgent(),
                );

                return ErrorResource::forbidden('This action is unauthorized.', 'role_not_allowed')->toResponse($request);
            }

            return ErrorResource::forbidden('This action is unauthorized.', 'role_not_allowed')->toResponse($request);
        }

        return $next($request);
    }
}
