import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { ROUTES } from "@/constants/routes";
import { getMemberStats } from "@/features/analytics/api/stats";
import { HumanStats } from "@/features/analytics/components/human-stats";
import { PetStats } from "@/features/analytics/components/pet-stats";
import { getServerApi } from "@/lib/api/server";
import { requireAccount } from "@/lib/auth/require-account";

export const metadata: Metadata = { title: "Stats" };

// AN-01 My stats (pet) and AN-02 Match & request history (human), on one address. Which of the two is shown is
// what the API answers for the signed-in account (`role`), never something the page is told (SEC-AUTHZ-02). An
// admin has no stats of its own (the API answers 403), so it is sent to the platform's dashboard instead.
export default async function StatsPage() {
  const account = await requireAccount(ROUTES.stats);
  if (account.role === "admin") redirect(ROUTES.adminHome);

  const stats = await getMemberStats(await getServerApi());

  return stats.role === "pet" ? (
    <>
      <PageHeader title="My stats" description="How my resume is doing. Totals count from the day I joined." />
      <PetStats stats={stats} />
    </>
  ) : (
    <>
      <PageHeader title="Match & request history" description="Your matches and the requests your home received. Totals count from the day you joined." />
      <HumanStats stats={stats} />
    </>
  );
}
