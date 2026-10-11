import Link from "next/link";
import { Table, type TableColumn } from "@/components/data-display/table";
import { EmptyState } from "@/components/feedback/empty-state";
import { Pagination } from "@/components/navigation/pagination";
import { Tabs } from "@/components/navigation/tabs";
import { buttonClasses } from "@/components/ui/button-styles";
import { adminReportPath } from "@/constants/routes";
import { formatDateTime } from "@/lib/utils/format-date";
import type { Paginated } from "@/types/api";
import type { ReportStatus } from "@/types/statuses";
import {
  ACTION_LABELS,
  REPORT_PAGE_PARAM,
  REPORT_REASON_LABELS,
  REPORT_TABS,
  REPORT_TAB_PARAM,
  TARGET_TYPE_LABELS,
  countReports,
  reportedItemName,
} from "../schemas/reports";
import type { ReportSummary } from "../types/reports";

type Props = {
  queue: Paginated<ReportSummary>;
  /** The open tab. */
  status: ReportStatus;
  /** The page's own query, so the page links keep the tab. */
  searchParams: Record<string, string | string[] | undefined>;
};

const reported: TableColumn<ReportSummary> = {
  key: "reported",
  header: "Reported",
  rowHeader: true,
  wrap: true,
  cell: (report) => (
    <span className="flex min-w-0 flex-col">
      {/* Also a link: on phones the Review button is a sideways scroll away. */}
      <Link href={adminReportPath(report.id)} className="underline hover:text-primary">
        {reportedItemName(report)}
      </Link>
      <span className="text-sm font-normal text-ink-muted">
        {TARGET_TYPE_LABELS[report.target_type]}
        {report.reporter && `, latest report by ${report.reporter.display_name}`}
      </span>
      {/* On a phone the Reports column is a sideways scroll away, and the count is what orders the queue. */}
      <span aria-hidden="true" className="text-sm font-bold md:hidden">
        {countReports(report.reports_count)}
      </span>
    </span>
  ),
};

const reason: TableColumn<ReportSummary> = { key: "reason", header: "Reason", wrap: true, cell: (report) => REPORT_REASON_LABELS[report.reason] };

// How often an item was reported is what orders the queue, so the number is written large enough to scan down.
const count: TableColumn<ReportSummary> = {
  key: "reports",
  header: "Reports",
  align: "end",
  cell: (report) => (
    <span className="font-bold tabular-nums">
      {report.reports_count}
      <span className="sr-only"> {report.reports_count === 1 ? "report" : "reports"}</span>
    </span>
  ),
};

const open = (label: string): TableColumn<ReportSummary> => ({
  key: "open",
  header: label,
  headerHidden: true,
  align: "end",
  cell: (report) => (
    <Link href={adminReportPath(report.id)} className={buttonClasses({ size: "sm" })}>
      {label}
      <span className="sr-only">: {reportedItemName(report)}</span>
    </Link>
  ),
});

const COLUMNS: Record<ReportStatus, TableColumn<ReportSummary>[]> = {
  open: [
    reported,
    reason,
    count,
    { key: "latest", header: "Latest", cell: (report) => <time dateTime={report.created_at}>{formatDateTime(report.created_at)}</time> },
    open("Review"),
  ],
  resolved: [
    reported,
    reason,
    count,
    {
      key: "action",
      header: "Action taken",
      wrap: true,
      cell: ({ report_action: action }) =>
        action ? (
          <span className="flex flex-col">
            {ACTION_LABELS[action.action]}
            <span className="text-sm text-ink-muted">
              {action.performed_by ? `by ${action.performed_by}, ` : ""}
              <time dateTime={action.created_at}>{formatDateTime(action.created_at)}</time>
            </span>
          </span>
        ) : (
          "Resolved"
        ),
    },
    open("View"),
  ],
};

const EMPTY: Record<ReportStatus, { title: string; description: string }> = {
  open: { title: "No open reports", description: "A profile, post, comment or account that a member reports shows up here, most reported first." },
  resolved: { title: "No resolved reports yet", description: "Reports you remove, suspend for or dismiss move here, with the action taken, by whom and when." },
};

function summary(total: number, status: ReportStatus): string {
  const items = `${total} reported ${total === 1 ? "item" : "items"}`;
  return status === "open" ? `${items} waiting, most reported first` : `${items} resolved`;
}

// The reports queue (RP-03): one row per reported profile, post, comment or account, with how many members
// reported it. Open lists what is waiting, most reported first; Resolved lists what was decided, by whom and when.
// The tab and the page live in the URL. Only the open tab's rows are loaded; the page re-renders on a tab change.
export function ReportsQueue({ queue, status, searchParams }: Props) {
  const panel = (
    <div className="flex flex-col gap-4">
      {queue.meta.total > 0 && (
        <p role="status" className="text-sm text-ink-muted">
          {summary(queue.meta.total, status)}
        </p>
      )}
      <Table
        caption={status === "open" ? "Open reports" : "Resolved reports"}
        columns={COLUMNS[status]}
        rows={queue.data}
        rowKey={(report) => report.id}
        empty={<EmptyState icon={status === "open" ? "circle-check" : "inbox"} {...EMPTY[status]} />}
      />
      <Pagination page={queue.meta.current_page} totalPages={queue.meta.last_page} searchParams={searchParams} param={REPORT_PAGE_PARAM} label="Pages of reports" />
    </div>
  );

  return (
    <Tabs
      label="Report status"
      param={REPORT_TAB_PARAM}
      resetParams={[REPORT_PAGE_PARAM]}
      tabs={REPORT_TABS.map((tab) => ({ ...tab, content: tab.id === status ? panel : undefined }))}
    />
  );
}
