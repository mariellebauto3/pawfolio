import Link from "next/link";
import { Table, type TableColumn } from "@/components/data-display/table";
import { EmptyState } from "@/components/feedback/empty-state";
import { buttonClasses } from "@/components/ui/button-styles";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { ROUTES, requestPath } from "@/constants/routes";
import { REQUEST_STATUS_LABELS } from "@/constants/statuses";
import { formatDate } from "@/lib/utils/format-date";
import type { HistoryRequest } from "../types/stats";

type Props = {
  /** Whose history this is: a pet lists the homes it applied to, a human the pets that applied. */
  role: "pet" | "human";
  requests: HistoryRequest[];
  /** How many requests the account has in all; the table lists the latest only. */
  total: number;
};

const date = (iso: string | null) => (iso ? <time dateTime={iso}>{formatDate(iso)}</time> : <span className="text-ink-muted">Not set</span>);

// Request history on a stats page (AN-01, AN-02): the latest requests with where each stands, read-only. A status
// is shown, never set (FR27). Names are what a pet or a human typed, rendered as text (SEC-FE-01).
export function RequestHistory({ role, requests, total }: Props) {
  const other = (request: HistoryRequest) => (role === "pet" ? request.home_name : request.pet_name);

  const columns: TableColumn<HistoryRequest>[] = [
    {
      key: "who",
      header: role === "pet" ? "Home" : "Pet",
      rowHeader: true,
      wrap: true,
      // Also a link: on phones the Open button is a sideways scroll away.
      cell: (request) => (
        <Link href={requestPath(request.id)} className="underline hover:text-primary">
          {other(request)}
        </Link>
      ),
    },
    { key: "sent", header: "Sent", cell: (request) => date(request.sent_at) },
    { key: "status", header: "Status", cell: (request) => <StatusBadge status={REQUEST_STATUS_LABELS[request.status]} /> },
    { key: "updated", header: "Last update", cell: (request) => date(request.updated_at) },
    {
      key: "open",
      header: "Open",
      headerHidden: true,
      align: "end",
      cell: (request) => (
        <Link href={requestPath(request.id)} className={buttonClasses({ size: "sm" })}>
          Open<span className="sr-only">: request {role === "pet" ? "to" : "from"} {other(request)}</span>
        </Link>
      ),
    },
  ];

  return (
    <Card
      title="Request history"
      description={total > requests.length ? `The latest ${requests.length} of ${total}.` : undefined}
      action={
        total > requests.length ? (
          <Link href={ROUTES.requests} className={buttonClasses({ size: "sm", variant: "tertiary" })}>
            See all requests
          </Link>
        ) : undefined
      }
    >
      {requests.length > 0 ? (
        <Table caption="Request history" columns={columns} rows={requests} rowKey={(request) => request.id} />
      ) : role === "pet" ? (
        <EmptyState
          icon="inbox"
          title="No requests yet"
          description="A request shows up here once you apply to a home."
          action={
            <Link href={ROUTES.matches} className={buttonClasses({ variant: "primary" })}>
              See Homes for You
            </Link>
          }
        />
      ) : (
        <EmptyState icon="inbox" title="No requests yet" description="A request shows up here once a pet applies to your home. Keep Open to Adopt on so pets can find you." />
      )}
    </Card>
  );
}
