import Link from "next/link";
import { Table, type TableColumn } from "@/components/data-display/table";
import { EmptyState } from "@/components/feedback/empty-state";
import { Pagination } from "@/components/navigation/pagination";
import { Tabs } from "@/components/navigation/tabs";
import { Tag } from "@/components/ui/tag";
import { requestPath } from "@/constants/routes";
import { formatDateTime } from "@/lib/utils/format-date";
import type { Paginated } from "@/types/api";
import { ACTIVITY_PAGE_PARAM, ACTIVITY_TABS, ACTIVITY_TAB_PARAM, ACTIVITY_TYPE_LABELS, type ActivityTab, actionLabel, byLine, memberAboutLine } from "../schemas/activity-logs";
import type { ActivityEntry } from "../types/activity-logs";
import { ValueChange } from "./value-change";

type Props = {
  entries: Paginated<ActivityEntry>;
  tab: ActivityTab;
  /** The page's own query, so the page links keep the tab. */
  searchParams: Record<string, string | string[] | undefined>;
};

const columns: TableColumn<ActivityEntry>[] = [
  { key: "when", header: "When", cell: (entry) => <time dateTime={entry.created_at}>{formatDateTime(entry.created_at)}</time> },
  {
    key: "what",
    header: "Activity",
    rowHeader: true,
    wrap: true,
    cell: (entry) => {
      const about = memberAboutLine(entry);
      // Who did it, when that wasn't the reader, and the device of a sign-in. Names are text from people (SEC-FE-01).
      const details = [byLine(entry.actor), entry.device].filter(Boolean).join(", ");
      return (
        <span className="flex min-w-0 flex-col gap-1">
          <span>{actionLabel(entry)}</span>
          {about && (
            <span className="text-sm font-normal wrap-break-word text-ink-muted">
              {entry.target?.kind === "request" ? (
                <Link href={requestPath(entry.target.id)} className="underline hover:text-primary">
                  {about}
                </Link>
              ) : (
                about
              )}
            </span>
          )}
          {details && <span className="text-sm font-normal wrap-break-word text-ink-muted">{details}</span>}
          <ValueChange before={entry.before_value} after={entry.after_value} />
        </span>
      );
    },
  },
  { key: "type", header: "Type", cell: (entry) => <Tag>{ACTIVITY_TYPE_LABELS[entry.type]}</Tag> },
];

// My activity (LG-01 pet, LG-02 human; FR41): what the account did, and what was done to it, its profile and its
// requests, newest first and read-only. The tab and the page live in the URL (?tab=security&page=2). The API lists
// only the reader's own activity and keeps an admin's name and reasons out of it; this screen shows what it is given.
export function MyActivity({ entries, tab, searchParams }: Props) {
  const label = ACTIVITY_TABS.find((candidate) => candidate.id === tab)?.label ?? "All";

  const panel =
    entries.meta.total === 0 ? (
      <div className="rounded-card border border-line bg-surface">
        {tab === "all" ? (
          <EmptyState icon="clock" title="No activity yet" description="Signing in, sending or answering a request and changes to your account show up here." />
        ) : (
          <EmptyState icon="clock" title={`No ${label} activity yet`} description="Nothing of this kind has happened on your account. The All tab lists everything." />
        )}
      </div>
    ) : (
      <div className="flex flex-col gap-4">
        <Table caption={tab === "all" ? "My activity" : `My activity: ${label}`} columns={columns} rows={entries.data} rowKey={(entry) => entry.id} />
        <Pagination page={entries.meta.current_page} totalPages={entries.meta.last_page} searchParams={searchParams} param={ACTIVITY_PAGE_PARAM} label="Pages of activity" />
      </div>
    );

  return (
    <Tabs
      label="Activity by type"
      param={ACTIVITY_TAB_PARAM}
      resetParams={[ACTIVITY_PAGE_PARAM]}
      tabs={ACTIVITY_TABS.map((candidate) => ({ id: candidate.id, label: candidate.label, content: candidate.id === tab ? panel : undefined }))}
    />
  );
}
