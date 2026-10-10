import type { ReactNode } from "react";
import { AdminShell } from "@/components/layout/admin-shell";
import { getAdminSidebarCounts } from "@/features/accounts/api/admin-sidebar";
import { AdminSectionSeen } from "@/features/accounts/components/admin-section-seen";
import { getServerApi } from "@/lib/api/server";

// Laravel checks the admin role independently on every admin API.
export default async function AdminLayout({ children }: { children: ReactNode }) {
  // The sidebar's counts for Verification (AU-22), Reports (RP-03) and Requests & Meets (MG-16): what arrived in
  // each since this admin last opened it. A layout isn't rendered again on navigation, so `AdminSectionSeen` loads
  // it again once a section was opened, and a screen that changes a queue calls router.refresh(). If the API can't
  // say, the sidebar shows no counts rather than breaking every page.
  const counts = await getAdminSidebarCounts(await getServerApi()).catch(() => ({}));

  return (
    <AdminShell counts={counts}>
      {children}
      <AdminSectionSeen />
    </AdminShell>
  );
}
