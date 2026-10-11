<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Accounts;

use App\Enums\AdminSection;
use App\Http\Controllers\Controller;
use App\Http\Resources\ErrorResource;
use App\Http\Resources\ResponseResource;
use App\Services\Accounts\AdminSidebarCounts;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * The admin sidebar's counts and what clears them (GN-01, docs/api/community-reports-and-admin.md). Admins only,
 * through the route's `role:admin` middleware (SEC-AUTHZ-07).
 */
class AdminSidebarController extends Controller
{
    public function __construct(
        private readonly AdminSidebarCounts $counts,
    ) {}

    /** What is new in each counted section for the admin who asks. */
    public function show(Request $request): ResponseResource
    {
        return ResponseResource::make(['counts' => $this->counts->for($request->user())]);
    }

    /**
     * The admin has a section open: its count starts again from now. Whose count it is and the time are the
     * session's and the server's, never the body's (SEC-AUTHZ-02, SEC-INPUT-04); the section is one of a fixed
     * list, and anything else answers like a page that doesn't exist (SEC-INPUT-03).
     */
    public function seen(Request $request, string $section): Response
    {
        $known = AdminSection::tryFrom($section);
        if ($known === null) {
            return ErrorResource::notFound("We couldn't find that section.")->toResponse($request);
        }

        $this->counts->markSeen($request->user(), $known);

        return response()->noContent();
    }
}
