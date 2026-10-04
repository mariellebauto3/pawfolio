<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Enums\Role;
use App\Http\Resources\ErrorResource;
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
            return ErrorResource::forbidden('You do not have permission to perform this action.')->toResponse($request);
        }

        return $next($request);
    }
}
