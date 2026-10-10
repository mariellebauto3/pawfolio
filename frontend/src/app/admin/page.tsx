import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { getPlatformDashboard } from "@/features/analytics/api/stats";
import { PlatformDashboard } from "@/features/analytics/components/platform-dashboard";
import { getServerApi } from "@/lib/api/server";

export const metadata: Metadata = { title: "Dashboard" };

// AN-03 Platform dashboard, where an admin lands after signing in (ROUTES.adminHome). Read on every visit, so the
// numbers are as they stand now. The API checks the admin role itself (SEC-AUTHZ-07).
export default async function AdminDashboardPage() {
  const dashboard = await getPlatformDashboard(await getServerApi());

  return (
    <>
      <PageHeader title="Platform dashboard" description="Pawfolio as it stands now, and how the last six months went." />
      <PlatformDashboard dashboard={dashboard} />
    </>
  );
}
