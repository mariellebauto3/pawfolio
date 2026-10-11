import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { ROUTES } from "@/constants/routes";
import { getMonitoredRequests, getOverdueRequestCount } from "@/features/adoption-requests/api/admin-requests";
import { MonitorFilters } from "@/features/adoption-requests/components/monitor-filters";
import { RequestsMonitor } from "@/features/adoption-requests/components/requests-monitor";
import { MONITOR_PAGE_PARAM, MONITOR_SEARCH_PARAM, MONITOR_STATUS_PARAM, MONITOR_TAB_PARAM, monitorFiltersFromUrl } from "@/features/adoption-requests/schemas/admin-requests";
import { readBooking } from "@/features/meet-and-greet/api/meetings";
import { getServerApi } from "@/lib/api/server";
import { pageFromUrl } from "@/lib/utils/page-param";

export const metadata: Metadata = { title: "Requests & Meet & Greets" };

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// RQ-18, with MG-15 and MG-16 as its tabs. The tab, the search, the status filter and the page number live in the
// URL (?tab=overdue&status=awaiting_decision&q=mochi&page=2), so every view of the monitor can be linked and
// survives a reload. Only values the API knows are sent to it, and it checks the admin role itself (SEC-AUTHZ-07).
export default async function RequestsMonitorPage({ searchParams }: Props) {
  const params = await searchParams;
  const filters = monitorFiltersFromUrl(params);
  const api = await getServerApi();
  const [requests, overdueCount] = await Promise.all([
    // A request's Meet & Greet is the Meet & Greet module's to read, so its reader is handed in.
    getMonitoredRequests(api, readBooking, { ...filters, page: pageFromUrl(params[MONITOR_PAGE_PARAM]) }),
    // The count beside the Overdue tab. The list still loads if the API can't say.
    getOverdueRequestCount(api).catch(() => undefined),
  ]);

  // A page past the end, e.g. after a filter narrowed the list: go to the page that is the last one now.
  if (requests.data.length === 0 && requests.meta.total > 0 && requests.meta.current_page > requests.meta.last_page) {
    const query = new URLSearchParams({
      ...(filters.tab !== "all" && { [MONITOR_TAB_PARAM]: filters.tab }),
      ...(filters.status && { [MONITOR_STATUS_PARAM]: filters.status }),
      ...(filters.search && { [MONITOR_SEARCH_PARAM]: filters.search }),
      ...(requests.meta.last_page > 1 && { [MONITOR_PAGE_PARAM]: String(requests.meta.last_page) }),
    }).toString();
    redirect(query ? `${ROUTES.adminRequests}?${query}` : ROUTES.adminRequests);
  }

  return (
    <>
      <PageHeader title="Requests & Meet & Greets" description="Every adoption request and meeting on the platform. Newest first." actions={<MonitorFilters filters={filters} />} />
      <RequestsMonitor requests={requests} filters={filters} overdueCount={overdueCount} searchParams={params} />
    </>
  );
}
