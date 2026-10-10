import type { ReactNode } from "react";
import { AdminShell } from "@/components/layout/admin-shell";
import { getOverdueRequestCount } from "@/features/adoption-requests/api/admin-requests";
import { getVerificationQueueSize } from "@/features/auth/api/verification-review";
import { getOpenReportCount } from "@/features/reports/api/reports";
import { getServerApi } from "@/lib/api/server";

// Admin pages. proxy.ts sends non-admins away first, as a convenience only: every /api/v1/admin endpoint checks the
// admin role itself (SEC-AUTHZ-07, SEC-FE-06).
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const api = await getServerApi();
  // The sidebar's "Verification" (AU-22), "Reports" (RP-03) and "Requests & Meets" counts, the last one being the
  // requests overdue for a decision (MG-16). A layout isn't rendered again on navigation, so a screen that changes
  // a queue calls router.refresh(). If the API can't say, the sidebar shows no count rather than breaking every page.
  const [verification, reports, requests] = await Promise.all([
    getVerificationQueueSize(api).catch(() => undefined),
    getOpenReportCount(api).catch(() => undefined),
    getOverdueRequestCount(api).catch(() => undefined),
  ]);

  return <AdminShell counts={{ verification, reports, requests }}>{children}</AdminShell>;
}
