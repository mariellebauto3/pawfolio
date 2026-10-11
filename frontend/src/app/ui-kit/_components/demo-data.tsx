import Link from "next/link";
import type { TableColumn } from "@/components/data-display/table";
import type { TimelineEvent } from "@/components/data-display/timeline";
import { Avatar } from "@/components/ui/avatar";
import { buttonClasses } from "@/components/ui/button-styles";
import { StatusBadge } from "@/components/ui/status-badge";
import type { StatusName } from "@/constants/status-badges";

// Fake demo data for /ui-kit (SEC-PRIV-06): names from the LoFi, no real people.

export type QueueRow = {
  id: number;
  name: string;
  type: "Pet" | "Human";
  city: string;
  submitted: string;
  documents: number;
  status: StatusName;
};

export const QUEUE: QueueRow[] = [
  { id: 1, name: "Mochi", type: "Pet", city: "Quezon City", submitted: "Sep 28, 2026", documents: 2, status: "Pending Verification" },
  { id: 2, name: "Ana Santos", type: "Human", city: "Quezon City", submitted: "Sep 28, 2026", documents: 1, status: "Pending Verification" },
  { id: 3, name: "Kulit", type: "Pet", city: "Marikina", submitted: "Sep 27, 2026", documents: 2, status: "Resubmitted" },
  { id: 4, name: "Ben Reyes", type: "Human", city: "Pasig", submitted: "Sep 25, 2026", documents: 1, status: "Denied" },
  { id: 5, name: "Luna", type: "Pet", city: "Makati", submitted: "Sep 24, 2026", documents: 3, status: "Active" },
];

export const QUEUE_COLUMNS: TableColumn<QueueRow>[] = [
  {
    key: "account",
    header: "Account",
    rowHeader: true,
    cell: (row) => (
      <span className="flex items-center gap-3">
        <Avatar name={row.name} alt="" size="sm" />
        {row.name}
      </span>
    ),
  },
  { key: "type", header: "Type", cell: (row) => row.type },
  { key: "city", header: "City", cell: (row) => row.city },
  { key: "submitted", header: "Submitted", cell: (row) => row.submitted },
  { key: "documents", header: "Documents", align: "end", cell: (row) => row.documents },
  { key: "status", header: "Status", cell: (row) => <StatusBadge status={row.status} /> },
  {
    key: "actions",
    header: "Actions",
    headerHidden: true,
    align: "end",
    cell: (row) => (
      <Link href="/ui-kit" className={buttonClasses({ variant: "tertiary", size: "sm" })}>
        Review<span className="sr-only"> {row.name}</span>
      </Link>
    ),
  },
];

export const OPEN_REQUEST: TimelineEvent[] = [
  { id: 1, title: "Mochi sent an adoption request", when: "Sep 2, 2026", dateTime: "2026-09-02", status: "Sent" },
  {
    id: 2,
    title: "Ana Santos approved it",
    when: "Sep 4, 2026",
    dateTime: "2026-09-04",
    status: "Approved",
    description: "Mochi is now In Process. Mochi's other open requests are On Hold.",
  },
  { id: 3, title: "Meet & Greet booked", when: "Sep 6, 2026", dateTime: "2026-09-06", status: "Meet Scheduled" },
  {
    id: 4,
    title: "Ana confirmed the meeting",
    when: "Sep 7, 2026",
    dateTime: "2026-09-07",
    description: "Contact details are now visible to both sides.",
  },
  { id: 5, title: "Meeting time passed", when: "Sep 14, 2026", dateTime: "2026-09-14", status: "Awaiting Decision" },
  { id: 6, title: "Ana chooses Adopt or Decline", when: "Due by Sep 21, 2026", dateTime: "2026-09-21", upcoming: true },
];

export const ENDED_REQUESTS: TimelineEvent[] = [
  { id: 1, title: "Luna sent an adoption request", when: "May 30, 2026", dateTime: "2026-05-30", status: "Sent" },
  { id: 2, title: "Ana Santos chose Adopt", when: "Jun 14, 2026", dateTime: "2026-06-14", status: "Adopted" },
  { id: 3, title: "Kulit sent an adoption request", when: "Aug 3, 2026", dateTime: "2026-08-03", status: "Sent" },
  {
    id: 4,
    title: "Ben Reyes declined it",
    when: "Aug 9, 2026",
    dateTime: "2026-08-09",
    status: "Declined",
    description: "Kulit can apply to Ben again after 30 days.",
  },
];

/** Criterion, points, weight — a slice of the MT-03 breakdown. */
export const BREAKDOWN_SAMPLE: Array<[string, number, number]> = [
  ["Activity level and energy", 18, 20],
  ["Hours away and time alone", 13, 15],
  ["Kids and other pets", 9, 10],
  ["Special needs and care", 6, 10],
];
