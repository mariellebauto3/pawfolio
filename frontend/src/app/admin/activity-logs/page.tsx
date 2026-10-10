import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { ROUTES } from "@/constants/routes";
import { getActivityLogs } from "@/features/activity-logs/api/activity-logs";
import { ActivityLogFilters } from "@/features/activity-logs/components/activity-log-filters";
import { ActivityLogs } from "@/features/activity-logs/components/activity-logs";
import { DownloadCsvButton } from "@/features/activity-logs/components/download-csv-button";
import { LOG_PAGE_PARAM, logFiltersFromUrl, logQueryFor } from "@/features/activity-logs/schemas/activity-logs";
import { getServerApi } from "@/lib/api/server";
import { pageFromUrl } from "@/lib/utils/page-param";

export const metadata: Metadata = { title: "Activity logs" };

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// LG-03 Activity logs, with LG-04 as the drawer a row opens. The filters and the page number live in the URL
// (?actor=admin&type=moderation&page=2), so every view can be linked and survives a reload. Only values the API
// knows are sent to it, and it checks the admin role itself (SEC-AUTHZ-07).
export default async function ActivityLogsPage({ searchParams }: Props) {
  const params = await searchParams;
  const filters = logFiltersFromUrl(params);
  const entries = await getActivityLogs(await getServerApi(), { ...filters, page: pageFromUrl(params[LOG_PAGE_PARAM]) });

  // A page past the end, e.g. after a filter narrowed the list: go to the page that is the last one now.
  if (entries.data.length === 0 && entries.meta.total > 0 && entries.meta.current_page > entries.meta.last_page) {
    const query = new URLSearchParams(logQueryFor(filters, entries.meta.last_page)).toString();
    redirect(query ? `${ROUTES.adminActivityLogs}?${query}` : ROUTES.adminActivityLogs);
  }

  return (
    <>
      <PageHeader
        title="Activity logs"
        description="Every admin action and status change: who, what, when and why."
        actions={
          <>
            <ActivityLogFilters filters={filters} />
            {entries.meta.total > 0 && <DownloadCsvButton scope="all" filters={filters} label="Export CSV" />}
          </>
        }
      />
      <ActivityLogs entries={entries} filters={filters} searchParams={params} />
    </>
  );
}
