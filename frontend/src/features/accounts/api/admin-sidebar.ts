import { ADMIN_COUNTED_SECTIONS, type AdminCountedSection, type AdminNavCounts } from "@/components/navigation/nav-config";
import { type ApiClient, apiPath } from "@/lib/api/core";
import { isRecord, unexpected } from "@/lib/api/readers";

// The admin sidebar's counts (docs/api/community-reports-and-admin.md, "The admin sidebar"; GN-01). Each count is
// what arrived in its section since this admin last opened it. The read works from a Server Component with
// `getServerApi()`; "seen" runs in the browser, where the CSRF token is. The API checks the admin role itself
// (SEC-AUTHZ-07), and the one path with a value is built with apiPath (SEC-FE-08).

const SIDEBAR = "/admin/sidebar";
const COUNTS_PROBLEM = "We couldn't load the sidebar's counts.";

/** What is new in Verification, Reports and Requests & Meets. A count the API didn't send is left out. */
export async function getAdminSidebarCounts(client: ApiClient): Promise<AdminNavCounts> {
  const response = await client.get<unknown>(SIDEBAR);
  const sent = isRecord(response) && isRecord(response.data) ? response.data.counts : undefined;
  if (!isRecord(sent)) throw unexpected(COUNTS_PROBLEM);

  const counts: AdminNavCounts = {};
  for (const section of ADMIN_COUNTED_SECTIONS) {
    const count = sent[section];
    if (typeof count === "number" && Number.isInteger(count) && count >= 0) counts[section] = count;
  }
  return counts;
}

/** Tells the API the admin has a section open, so its count starts again from now. */
export async function markAdminSectionSeen(client: ApiClient, section: AdminCountedSection): Promise<void> {
  // A background call: a session that ended is found out by what the admin does next, not by this.
  await client.post<unknown>(apiPath`/admin/sidebar/${section}/seen`, undefined, { skipAuthRedirect: true });
}
