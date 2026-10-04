import type { ReactNode } from "react";
import { AdminShell } from "@/components/layout/admin-shell";
import { getVerificationQueueSize } from "@/features/auth/api/verification-review";
import { getServerApi } from "@/lib/api/server";

// Admin pages. proxy.ts sends non-admins away first, as a convenience only: every /api/v1/admin endpoint checks the
// admin role itself (SEC-AUTHZ-07, SEC-FE-06).
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const api = await getServerApi();
  // The sidebar's "Verification" count (AU-22). A layout isn't rendered again on navigation, so a screen that changes
  // the queue calls router.refresh(). If the API can't say, the sidebar shows no count rather than breaking every page.
  const verification = await getVerificationQueueSize(api).catch(() => undefined);

  return <AdminShell counts={{ verification }}>{children}</AdminShell>;
}
