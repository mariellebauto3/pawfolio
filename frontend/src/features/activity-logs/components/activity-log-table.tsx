"use client";

import { useState } from "react";
import { Table, type TableColumn } from "@/components/data-display/table";
import { Tag } from "@/components/ui/tag";
import { formatDateTime } from "@/lib/utils/format-date";
import { LogEntryDrawer } from "../dialogs/log-entry-drawer";
import { ACTIVITY_TYPE_LABELS, ACTOR_ROLE_NAMES, actionLabel, reasonText } from "../schemas/activity-logs";
import type { ActivityEntry } from "../types/activity-logs";
import { ValueChange } from "./value-change";

type Props = {
  entries: ActivityEntry[];
};

// The rows of the activity logs (LG-03): when, who, what, type and why. What happened is a button that opens the
// entry's detail (LG-04) in a drawer; closing it returns focus to that button. A client component only for that
// drawer: the rows themselves come from the server. Names and reasons are text from people (SEC-FE-01).
export function ActivityLogTable({ entries }: Props) {
  const [open, setOpen] = useState<ActivityEntry | null>(null);

  const columns: TableColumn<ActivityEntry>[] = [
    { key: "when", header: "When", cell: (entry) => <time dateTime={entry.created_at}>{formatDateTime(entry.created_at)}</time> },
    {
      key: "who",
      header: "Who",
      cell: (entry) => (
        <span className="flex flex-col">
          {entry.actor.display_name}
          {entry.actor.role !== "system" && <span className="text-sm text-ink-muted">{ACTOR_ROLE_NAMES[entry.actor.role]}</span>}
        </span>
      ),
    },
    {
      key: "what",
      header: "What",
      rowHeader: true,
      wrap: true,
      cell: (entry) => (
        <span className="flex min-w-0 flex-col items-start gap-1">
          <button type="button" onClick={() => setOpen(entry)} aria-haspopup="dialog" className="rounded-badge text-left font-bold underline hover:text-primary">
            {actionLabel(entry)}
            <span className="sr-only">: open the entry</span>
          </button>
          {/* What it was about, unless that is the actor's own account: the Who column already says so. */}
          {entry.subject_label && entry.subject_label !== entry.actor.display_name && <span className="text-sm font-normal wrap-break-word text-ink-muted">{entry.subject_label}</span>}
          <ValueChange before={entry.before_value} after={entry.after_value} />
        </span>
      ),
    },
    { key: "type", header: "Type", cell: (entry) => <Tag>{ACTIVITY_TYPE_LABELS[entry.type]}</Tag> },
    {
      key: "why",
      header: "Why",
      wrap: true,
      // A long reason is cut here; the drawer shows it whole.
      cell: (entry) => (entry.reason ? <span className="line-clamp-2 text-sm wrap-break-word text-ink-muted">{reasonText(entry.reason)}</span> : <span className="text-sm text-ink-muted">Not given</span>),
    },
  ];

  return (
    <>
      <Table caption="Activity logs" columns={columns} rows={entries} rowKey={(entry) => entry.id} />
      <LogEntryDrawer entry={open} onClose={() => setOpen(null)} />
    </>
  );
}
