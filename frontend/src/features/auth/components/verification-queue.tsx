import Link from "next/link";
import { Table, type TableColumn } from "@/components/data-display/table";
import { EmptyState } from "@/components/feedback/empty-state";
import { Pagination } from "@/components/navigation/pagination";
import { Tabs } from "@/components/navigation/tabs";
import { Avatar } from "@/components/ui/avatar";
import { buttonClasses } from "@/components/ui/button-styles";
import { StatusBadge } from "@/components/ui/status-badge";
import { ROUTES, adminVerificationReviewPath } from "@/constants/routes";
import { summarizeDocuments } from "@/lib/auth/account-status";
import { QUEUE_PAGE_PARAM, QUEUE_TAB_PARAM } from "@/lib/auth/verification-review";
import { formatDateTime } from "@/lib/utils/format-date";
import type { Paginated, PaginationMeta } from "@/types/api";
import type { VerificationQueueItem, VerifiedRole } from "@/types/verification-review";

type Props = {
  queue: Paginated<VerificationQueueItem>;
  /** The open tab; undefined for "All". */
  role: VerifiedRole | undefined;
  search: string | undefined;
  /** The page's own query, so the page links keep the tab and the search. */
  searchParams: Record<string, string | string[] | undefined>;
};

const TABS: { id: "all" | VerifiedRole; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pet", label: "Pet" },
  { id: "human", label: "Human" },
];

const ROLE_LABELS: Record<VerifiedRole, string> = { pet: "Pet", human: "Human" };

const COLUMNS: TableColumn<VerificationQueueItem>[] = [
  {
    key: "account",
    header: "Account",
    rowHeader: true,
    cell: (item) => (
      <span className="flex items-center gap-3">
        <Avatar name={item.display_name} alt="" size="sm" />
        <span className="flex min-w-0 flex-col">
          {/* Also a link: on phones the Review button is a sideways scroll away. */}
          <Link href={adminVerificationReviewPath(item.account_id)} className="underline hover:text-primary">
            {item.display_name}
          </Link>
          {item.caretaker_name && <span className="text-sm font-normal text-ink-muted">Caretaker: {item.caretaker_name}</span>}
        </span>
      </span>
    ),
  },
  { key: "type", header: "Type", cell: (item) => ROLE_LABELS[item.role] },
  {
    key: "submitted",
    header: "Submitted",
    cell: (item) => <time dateTime={item.submitted_at}>{formatDateTime(item.submitted_at)}</time>,
  },
  { key: "documents", header: "Documents", wrap: true, cell: (item) => summarizeDocuments(item.documents).join(", ") },
  {
    key: "status",
    header: "Status",
    cell: (item) => <StatusBadge status={item.is_resubmission ? "Resubmitted" : "Pending Verification"} />,
  },
  {
    key: "review",
    header: "Review",
    headerHidden: true,
    align: "end",
    cell: (item) => (
      <Link href={adminVerificationReviewPath(item.account_id)} className={buttonClasses({ size: "sm" })}>
        Review<span className="sr-only"> {item.display_name}</span>
      </Link>
    ),
  },
];

function summary({ total, from, to }: PaginationMeta, search: string | undefined): string {
  const accounts = `${total} ${total === 1 ? "account" : "accounts"}`;
  if (search) return `${accounts} ${total === 1 ? "matches" : "match"} “${search}”`;
  if (from !== null && to !== null && to - from + 1 < total) return `Showing ${from} to ${to} of ${accounts} waiting`;
  return `${accounts} waiting`;
}

// The verification queue (AU-22): every Pet and Human account waiting for review, oldest first, by tab, with the
// search and the pages kept in the URL. Only the open tab's rows are loaded; the page re-renders on a tab change.
export function VerificationQueue({ queue, role, search, searchParams }: Props) {
  const selected = role ?? "all";
  const clearSearch = { pathname: ROUTES.adminVerification, query: role ? { [QUEUE_TAB_PARAM]: role } : {} };

  const empty = search ? (
    <EmptyState
      icon="search"
      title={`No accounts match “${search}”`}
      description="Check the spelling, or search for the pet's, the human's or the caretaker's name."
      action={
        <Link href={clearSearch} className={buttonClasses()}>
          Clear search
        </Link>
      }
    />
  ) : (
    <EmptyState
      icon="circle-check"
      title={role ? `No ${ROLE_LABELS[role].toLowerCase()} accounts are waiting` : "No accounts are waiting"}
      description="New sign-ups and resubmitted accounts show up here, oldest first."
    />
  );

  const panel = (
    <div className="flex flex-col gap-4">
      {queue.meta.total > 0 && (
        <p role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
          {summary(queue.meta, search)}
          {search && (
            <Link href={clearSearch} className="font-bold text-primary underline hover:text-primary-hover">
              Clear search
            </Link>
          )}
        </p>
      )}
      <Table caption="Verification queue" columns={COLUMNS} rows={queue.data} rowKey={(item) => item.account_id} empty={empty} />
      <Pagination
        page={queue.meta.current_page}
        totalPages={queue.meta.last_page}
        searchParams={searchParams}
        param={QUEUE_PAGE_PARAM}
        label="Pages of the verification queue"
      />
    </div>
  );

  return (
    <Tabs
      label="Account type"
      param={QUEUE_TAB_PARAM}
      resetParams={[QUEUE_PAGE_PARAM]}
      tabs={TABS.map((tab) => ({ ...tab, content: tab.id === selected ? panel : undefined }))}
    />
  );
}
