import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/status-badge";
import { MAX_OPEN_REQUESTS, REQUEST_COOLDOWN_DAYS } from "@/constants/adoption-requests";
import { ROUTES, requestPath } from "@/constants/routes";
import { REQUEST_STATUS_LABELS } from "@/constants/statuses";
import { formatDate } from "@/lib/utils/format-date";
import type { ApplyBlocker, OpenRequestRef } from "../schemas/apply-state";

// Why a pet can't apply right now, in the words of the dialogs RQ-05 (3 open requests) and RQ-06 (the cooldown),
// and of the third rule that stops a request: one in process at a time (proposal §5.5). The same words head the
// dialog on a Home Profile and the Apply page of a pet that opened it anyway.

/** The title and the one line under it. `homeName` is the home the pet wanted to apply to. */
export function applyBlockedHeading(blocker: ApplyBlocker, homeName: string): { title: string; subtitle: string } {
  if (blocker.kind === "limit") {
    return {
      title: `You already have ${MAX_OPEN_REQUESTS} open requests`,
      subtitle: `A pet can have up to ${MAX_OPEN_REQUESTS} open requests at a time.`,
    };
  }
  if (blocker.kind === "cooldown") {
    return {
      title: `You can apply to ${homeName} again on ${formatDate(blocker.until)}`,
      subtitle: `After a Declined or Not Adopted result, a pet waits ${REQUEST_COOLDOWN_DAYS} days before applying to the same home.`,
    };
  }
  return {
    title: "You have a request in process",
    subtitle: "Only one of your requests can be in process at a time.",
  };
}

/** Where each rule sends the pet next. */
export function applyBlockedWayOut(blocker: ApplyBlocker): { href: string; label: string } {
  if (blocker.kind === "limit") return { href: ROUTES.requests, label: "Manage my requests" };
  if (blocker.kind === "cooldown") return { href: ROUTES.matches, label: "See other homes" };
  return { href: requestPath(blocker.request.id), label: "View that request" };
}

function OpenRequestRow({ request }: { request: OpenRequestRef }) {
  return (
    <li className="flex items-center gap-3 rounded-control border border-line px-3 py-2">
      {/* The name is written beside it, so the photo isn't read out as well. */}
      <Avatar name={request.home.full_name} src={request.home.profile_photo_url ?? undefined} alt="" size="sm" />
      <span className="min-w-0 flex-1 font-bold wrap-break-word">{request.home.full_name}</span>
      <StatusBadge status={REQUEST_STATUS_LABELS[request.status]} />
    </li>
  );
}

type Props = {
  blocker: ApplyBlocker;
  homeName: string;
};

/** What goes under the heading: the requests in the way, or the dates of the cooldown. */
export function ApplyBlockedDetails({ blocker, homeName }: Props) {
  if (blocker.kind === "limit") {
    return (
      <>
        <p>To apply to {homeName}, withdraw one of your open requests or wait until one closes.</p>
        <ul aria-label="Your open requests" className="flex flex-col gap-2">
          {blocker.open.map((request) => (
            <OpenRequestRow key={request.id} request={request} />
          ))}
        </ul>
      </>
    );
  }

  if (blocker.kind === "cooldown") {
    const { status, sent_at, closed_at } = blocker.last;
    const last = [sent_at && `Sent ${formatDate(sent_at)}`, `${REQUEST_STATUS_LABELS[status]} ${formatDate(closed_at)}`].filter(Boolean).join(" · ");
    return (
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
        <dt className="text-ink-muted">Last request</dt>
        <dd>{last}</dd>
        <dt className="text-ink-muted">Cooldown ends</dt>
        <dd className="font-bold">{formatDate(blocker.until)}</dd>
      </dl>
    );
  }

  return (
    <>
      <p>
        {blocker.request.home.full_name} is ahead of {homeName}: that request is moving toward a decision. If it ends without an adoption, you can
        apply to {homeName}.
      </p>
      <ul aria-label="Your request in process" className="flex flex-col gap-2">
        <OpenRequestRow request={blocker.request} />
      </ul>
    </>
  );
}
