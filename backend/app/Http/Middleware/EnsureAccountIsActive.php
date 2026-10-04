<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Block non-Active accounts from member endpoints (SEC-AUTHZ-06).
 *
 * Pending, Denied, Suspended and Deactivated accounts may only reach the
 * account-status and edit-submission endpoints (proposal §5.1). Every other
 * authenticated endpoint returns 403 with code "account_not_active" so the
 * frontend can send the user to /account-status.
 *
 * GET /api/v1/auth/me is exempt: pending/denied/suspended accounts need it to
 * render their status screen (docs/api/auth.md).
 */
class EnsureAccountIsActive
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && ! $user->isActive()) {
            return response()->json([
                'message' => "Your account can't do this until it's active.",
                'code' => 'account_not_active',
            ], 403);
        }

        return $next($request);
    }
}
