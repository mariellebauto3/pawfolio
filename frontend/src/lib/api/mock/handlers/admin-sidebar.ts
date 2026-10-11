import type { Query } from "@/lib/api/core";
import { adminAdoptionRoutes } from "@/lib/api/mock/handlers/admin-adoption";
import { adminVerificationRoutes } from "@/lib/api/mock/handlers/admin-verification";
import { reportRoutes } from "@/lib/api/mock/handlers/reports";
import { type MockContext, type MockRoute, fail, ok, route } from "@/lib/api/mock/router";

// The admin sidebar's counts in mock mode (docs/api/community-reports-and-admin.md, "The admin sidebar"). The API
// counts what arrived in a section since the admin last opened it; the mock has no such memory that a page
// rendered on the server and a call made in the browser would share, so it counts everything that is waiting, and
// accepts "seen" without keeping it. The sidebar still clears a count the moment its section is opened, for as
// long as the page stays loaded; a reload brings the fixture's numbers back.

const SECTIONS = ["verification", "reports", "requests"] as const;

/** How many rows one of the admin lists holds, asked the way the screens ask. */
function total(routes: readonly MockRoute[], pattern: string, query: Query, context: MockContext): number {
  const list = routes.find((candidate) => candidate.method === "GET" && candidate.pattern === pattern);
  const body = list?.handler({ ...context, params: {}, query: { ...query, per_page: 1 }, body: undefined }).body;
  const meta = typeof body === "object" && body !== null ? (body as { meta?: { total?: unknown } }).meta : undefined;
  return typeof meta?.total === "number" ? meta.total : 0;
}

export const adminSidebarRoutes: MockRoute[] = [
  route(
    "GET",
    "/admin/sidebar",
    (context) =>
      ok({
        counts: {
          verification: total(adminVerificationRoutes, "/admin/verifications", {}, context),
          reports: total(reportRoutes, "/admin/reports", { status: "open" }, context),
          requests: total(adminAdoptionRoutes, "/admin/adoption-requests", { tab: "overdue" }, context),
        },
      }),
    "admin",
  ),

  // A section that isn't one of the three answers like a page that doesn't exist, as the API does.
  route(
    "POST",
    "/admin/sidebar/:section/seen",
    ({ params }) => ((SECTIONS as readonly string[]).includes(params.section) ? { status: 204 } : fail(404, "We couldn't find that section.")),
    "admin",
  ),
];
