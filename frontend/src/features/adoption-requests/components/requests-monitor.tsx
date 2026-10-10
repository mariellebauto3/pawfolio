import Link from "next/link";
import { Table, type TableColumn } from "@/components/data-display/table";
import { EmptyState } from "@/components/feedback/empty-state";
import { Pagination } from "@/components/navigation/pagination";
import { Tabs } from "@/components/navigation/tabs";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button-styles";
import { StatusBadge } from "@/components/ui/status-badge";
import { ROUTES, adminRequestPath, adminResolvePath } from "@/constants/routes";
import { REQUEST_STATUS_LABELS } from "@/constants/statuses";
import { formatDate } from "@/lib/utils/format-date";
import type { Paginated } from "@/types/api";
import { MONITOR_PAGE_PARAM, MONITOR_TABS, MONITOR_TAB_PARAM, type MonitorFilters, type MonitorTab, meetingLines, overdueNote } from "../schemas/admin-requests";
import type { MonitoredRequest } from "../types/admin-requests";

type Props = {
  requests: Paginated<MonitoredRequest>;
  filters: MonitorFilters;
  /** How many requests are overdue for a decision, beside the Overdue tab. Left out when the API couldn't say. */
  overdueCount?: number;
  /** The page's own query, so the page links keep the tab and the filters. */
  searchParams: Record<string, string | string[] | undefined>;
};

/** "Mochi to Ana Santos": a request is between two, and the pet is the one that sent it. */
const between = (request: MonitoredRequest) => `${request.pet.name} to ${request.home_profile.full_name}`;

const date = (iso: string | null) => (iso ? <time dateTime={iso}>{formatDate(iso)}</time> : <span className="text-ink-muted">Not set</span>);

const who: TableColumn<MonitoredRequest> = {
  key: "who",
  header: "Pet to human",
  rowHeader: true,
  wrap: true,
  cell: (request) => (
    <span className="flex min-w-0 flex-col">
      {/* Also a link: on phones the View button is a sideways scroll away. */}
      <Link href={adminRequestPath(request.id)} className="underline hover:text-primary">
        {between(request)}
      </Link>
      <span className="text-sm font-normal text-ink-muted">Request #{request.id}</span>
    </span>
  ),
};

const status: TableColumn<MonitoredRequest> = {
  key: "status",
  header: "Status",
  cell: (request) =>
    // Overdue isn't a status of the proposal: it is Awaiting Decision that someone must follow up, so it gets the
    // "someone must act" tone and says how long it has waited.
    request.is_overdue ? (
      <span className="flex flex-col items-start gap-1">
        <Badge tone="attention">Overdue</Badge>
        <span className="text-sm text-ink-muted">{overdueNote(request)}</span>
      </span>
    ) : (
      <StatusBadge status={REQUEST_STATUS_LABELS[request.status]} />
    ),
};

const meeting: TableColumn<MonitoredRequest> = {
  key: "meeting",
  header: "Meet & Greet",
  wrap: true,
  cell: (request) => {
    const lines = meetingLines(request);
    if (!lines) return <span className="text-ink-muted">None booked</span>;
    return (
      <span className="flex flex-col">
        {lines.when}
        {/* The place a human typed, as text (SEC-FE-01). */}
        <span className="text-sm wrap-break-word text-ink-muted">
          {lines.where}. {lines.state}.
        </span>
      </span>
    );
  },
};

const sent: TableColumn<MonitoredRequest> = { key: "sent", header: "Sent", cell: (request) => date(request.sent_at) };
const updated: TableColumn<MonitoredRequest> = { key: "updated", header: "Updated", cell: (request) => date(request.updated_at) };

const view: TableColumn<MonitoredRequest> = {
  key: "view",
  header: "View",
  headerHidden: true,
  align: "end",
  cell: (request) => (
    <Link href={adminRequestPath(request.id)} className={buttonClasses({ size: "sm" })}>
      View<span className="sr-only">: {between(request)}</span>
    </Link>
  ),
};

// An overdue request is why Resolve exists on this screen (MG-16 → AL-07), so its row leads there as well.
const viewOrResolve: TableColumn<MonitoredRequest> = {
  key: "actions",
  header: "Actions",
  headerHidden: true,
  align: "end",
  cell: (request) => (
    <span className="flex items-center justify-end gap-2">
      <Link href={adminRequestPath(request.id)} className={buttonClasses({ size: "sm" })}>
        View<span className="sr-only">: {between(request)}</span>
      </Link>
      <Link href={adminResolvePath(request.pet.id, request.id)} className={buttonClasses({ size: "sm", variant: "tertiary" })}>
        Resolve<span className="sr-only">: {between(request)}</span>
      </Link>
    </span>
  ),
};

const COLUMNS: Record<MonitorTab, TableColumn<MonitoredRequest>[]> = {
  all: [who, status, sent, updated, view],
  "meet-and-greets": [who, status, meeting, sent, updated, view],
  overdue: [who, status, meeting, sent, updated, viewOrResolve],
};

const CAPTIONS: Record<MonitorTab, string> = { all: "Adoption requests", "meet-and-greets": "Requests with a Meet & Greet", overdue: "Requests overdue for a decision" };

const EMPTY: Record<MonitorTab, { icon: "inbox" | "calendar" | "circle-check"; title: string; description: string }> = {
  all: { icon: "inbox", title: "No adoption requests yet", description: "A request shows up here as soon as a pet sends one." },
  "meet-and-greets": { icon: "calendar", title: "No Meet & Greets yet", description: "A request shows up here once the pet books one of the human’s slots." },
  overdue: { icon: "circle-check", title: "No decision is overdue", description: "A request shows up here when 7 days pass after its meeting time without Adopt or Decline." },
};

function summary(total: number, { tab, search, status: statusFilter }: MonitorFilters): string {
  const what = tab === "overdue" ? (total === 1 ? "request overdue for a decision" : "requests overdue for a decision") : tab === "meet-and-greets" ? (total === 1 ? "request with a Meet & Greet" : "requests with a Meet & Greet") : total === 1 ? "request" : "requests";
  const filtered = [search && `matching “${search}”`, statusFilter && `that ${total === 1 ? "is" : "are"} ${REQUEST_STATUS_LABELS[statusFilter]}`].filter(Boolean).join(", ");
  return filtered ? `${total} ${what} ${filtered}` : `${total} ${what}`;
}

// The requests monitor (RQ-18, with its Meet & Greets tab MG-15 and its Overdue tab MG-16; FR36): every adoption
// request on the platform, newest first, read-only. The tab, the search, the status filter and the page live in the
// URL. Only the open tab's rows are loaded; the page re-renders on a tab change. No row carries a phone number or an
// address (SEC-PRIV-02), and what a pet or a human typed is rendered as text (SEC-FE-01).
export function RequestsMonitor({ requests, filters, overdueCount, searchParams }: Props) {
  const filtered = Boolean(filters.search || filters.status);
  const clear = { pathname: ROUTES.adminRequests, query: filters.tab === "all" ? {} : { [MONITOR_TAB_PARAM]: filters.tab } };

  const empty = filtered ? (
    <EmptyState
      icon="search"
      title="No requests match these filters"
      description="Check the spelling, search by the pet’s or the human’s name, or take the status filter off."
      action={
        <Link href={clear} className={buttonClasses()}>
          Clear filters
        </Link>
      }
    />
  ) : (
    <EmptyState {...EMPTY[filters.tab]} />
  );

  const panel = (
    <div className="flex flex-col gap-4">
      {requests.meta.total > 0 && (
        <p role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
          {summary(requests.meta.total, filters)}
          {filtered && (
            <Link href={clear} className="font-bold text-primary underline hover:text-primary-hover">
              Clear filters
            </Link>
          )}
        </p>
      )}
      {requests.data.length > 0 ? (
        <Table caption={CAPTIONS[filters.tab]} columns={COLUMNS[filters.tab]} rows={requests.data} rowKey={(request) => request.id} />
      ) : (
        // Outside the table: on a phone a table is wider than the screen, and its empty state would be cut in half.
        <div className="rounded-card border border-line bg-surface">{empty}</div>
      )}
      {filters.tab === "overdue" && requests.meta.total > 0 && (
        <p className="text-sm text-ink-muted">Flagged when 7 days of reminders pass after the meeting time with no Adopt or Decline.</p>
      )}
      <Pagination page={requests.meta.current_page} totalPages={requests.meta.last_page} searchParams={searchParams} param={MONITOR_PAGE_PARAM} label="Pages of requests" />
    </div>
  );

  return (
    <Tabs
      label="Requests to monitor"
      param={MONITOR_TAB_PARAM}
      resetParams={[MONITOR_PAGE_PARAM]}
      tabs={MONITOR_TABS.map((tab) => ({
        id: tab.id,
        label: tab.label,
        // Every overdue request on the platform, whatever the search and the status filter narrow the list to.
        count: tab.id === "overdue" && overdueCount ? overdueCount : undefined,
        content: tab.id === filters.tab ? panel : undefined,
      }))}
    />
  );
}
