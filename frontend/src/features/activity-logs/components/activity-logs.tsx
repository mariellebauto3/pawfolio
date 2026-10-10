import Link from "next/link";
import { EmptyState } from "@/components/feedback/empty-state";
import { Pagination } from "@/components/navigation/pagination";
import { buttonClasses } from "@/components/ui/button-styles";
import { ROUTES } from "@/constants/routes";
import type { Paginated } from "@/types/api";
import { ADMIN_EXPORT_LIMIT, LOG_PAGE_PARAM, type LogFilters, logSummary } from "../schemas/activity-logs";
import type { ActivityEntry } from "../types/activity-logs";
import { ActivityLogTable } from "./activity-log-table";

type Props = {
  entries: Paginated<ActivityEntry>;
  filters: LogFilters;
  /** The page's own query, so the page links keep the filters. */
  searchParams: Record<string, string | string[] | undefined>;
};

// Activity logs (LG-03, FR41, NFR9): every admin action and status change on the platform, newest first, with who,
// what, when and why. Read-only: there is no control here that changes an entry, and no endpoint that could
// (SEC-LOG-04). The filters and the page live in the URL (?actor=admin&type=moderation&page=2).
export function ActivityLogs({ entries, filters, searchParams }: Props) {
  const filtered = Boolean(filters.actor || filters.type);

  if (entries.meta.total === 0) {
    return (
      <div className="rounded-card border border-line bg-surface">
        {filtered ? (
          <EmptyState
            icon="search"
            title="No entries match these filters"
            description="Nothing of this type by this kind of actor has been logged."
            action={
              <Link href={ROUTES.adminActivityLogs} className={buttonClasses()}>
                Clear filters
              </Link>
            }
          />
        ) : (
          <EmptyState icon="clock" title="Nothing logged yet" description="An entry shows up here with every sign-in, admin action and status change." />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
        {logSummary(entries.meta.total, filters)}
        {filtered && (
          <Link href={ROUTES.adminActivityLogs} className="font-bold text-primary underline hover:text-primary-hover">
            Clear filters
          </Link>
        )}
      </p>
      <ActivityLogTable entries={entries.data} />
      {entries.meta.total > ADMIN_EXPORT_LIMIT && <p className="text-sm text-ink-muted">Export CSV holds the newest {ADMIN_EXPORT_LIMIT.toLocaleString("en-US")} of these. Narrow the list by actor or type to export the rest.</p>}
      <Pagination page={entries.meta.current_page} totalPages={entries.meta.last_page} searchParams={searchParams} param={LOG_PAGE_PARAM} label="Pages of log entries" />
    </div>
  );
}
