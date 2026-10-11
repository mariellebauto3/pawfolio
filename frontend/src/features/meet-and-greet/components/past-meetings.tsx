import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { requestPath } from "@/constants/routes";
import { REQUEST_STATUS_LABELS } from "@/constants/statuses";
import { formatDateTime } from "@/lib/utils/format-date";
import { slotPlace } from "../schemas/slots";
import type { PastMeeting } from "../types/meetings";

type Props = {
  meetings: PastMeeting[];
  /** How many there are in all; the list holds the latest. */
  total: number;
};

/** Where the request stands now: what waits on the human is named by what it asks for, as in the inbox (RQ-10). */
function Outcome({ meeting }: { meeting: PastMeeting }) {
  if (meeting.didnt_happen) return <Badge tone="closed">Didn’t happen</Badge>;
  if (meeting.request_status === "awaiting_decision") return <Badge tone="attention">Decision needed</Badge>;
  return <StatusBadge status={REQUEST_STATUS_LABELS[meeting.request_status]} />;
}

// MG-01 "Past Meet & Greets": the confirmed meetings whose time has come, latest first, each with the pet and
// where its request stands now, and a way back to that request.
export function PastMeetings({ meetings, total }: Props) {
  if (meetings.length === 0) {
    return <p className="text-sm text-ink-muted">Meet & Greets that have taken place are listed here, with what came of each.</p>;
  }

  return (
    <>
      <ul className="flex flex-col divide-y divide-line">
        {meetings.map((meeting) => (
          <li key={meeting.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-col gap-0.5">
              <Link href={requestPath(meeting.adoption_request_id)} className="self-start font-bold wrap-break-word text-primary hover:underline">
                {meeting.pet_name}
              </Link>
              <span className="text-sm wrap-break-word text-ink-muted">
                <time dateTime={meeting.slot.starts_at}>{formatDateTime(meeting.slot.starts_at)}</time> at {slotPlace(meeting.slot)}
              </span>
            </div>
            <span className="self-start sm:self-center">
              <Outcome meeting={meeting} />
            </span>
          </li>
        ))}
      </ul>
      {total > meetings.length && <p className="text-sm text-ink-muted">Showing the latest {meetings.length} of {total}.</p>}
    </>
  );
}
