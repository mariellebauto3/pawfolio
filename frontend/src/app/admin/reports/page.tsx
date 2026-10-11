import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { ROUTES } from "@/constants/routes";
import { getReports } from "@/features/reports/api/reports";
import { ReportsQueue } from "@/features/reports/components/reports-queue";
import { REPORT_PAGE_PARAM, REPORT_TAB_PARAM, reportTabFromUrl } from "@/features/reports/schemas/reports";
import { getServerApi } from "@/lib/api/server";
import { pageFromUrl } from "@/lib/utils/page-param";

export const metadata: Metadata = { title: "Reports" };

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// RP-03. The tab and the page number live in the URL (?tab=resolved&page=2), so every view of the queue can be
// linked and survives a reload. The API checks the admin role itself (SEC-AUTHZ-07).
export default async function ReportsPage({ searchParams }: Props) {
  const params = await searchParams;
  const status = reportTabFromUrl(params[REPORT_TAB_PARAM]);
  const queue = await getReports(await getServerApi(), { status, page: pageFromUrl(params[REPORT_PAGE_PARAM]) });

  // A page past the end, e.g. after the last item on it was resolved: go to the page that is the last one now.
  if (queue.data.length === 0 && queue.meta.total > 0 && queue.meta.current_page > queue.meta.last_page) {
    const query = new URLSearchParams({
      ...(status !== "open" && { [REPORT_TAB_PARAM]: status }),
      ...(queue.meta.last_page > 1 && { [REPORT_PAGE_PARAM]: String(queue.meta.last_page) }),
    }).toString();
    redirect(query ? `${ROUTES.adminReports}?${query}` : ROUTES.adminReports);
  }

  return (
    <>
      <PageHeader title="Reports & moderation" description="Reported profiles, posts, comments and accounts. Most reported first." />
      <ReportsQueue queue={queue} status={status} searchParams={params} />
    </>
  );
}
