import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button-styles";
import { OPEN_REQUEST_STATUSES, REQUEST_EXPIRY_DAYS } from "@/constants/adoption-requests";
import { ROUTES } from "@/constants/routes";
import { formatDate } from "@/lib/utils/format-date";
import type { RequestStatus } from "@/types/statuses";
import { DECLINE_REASON_LABELS, WITHDRAW_REASON_LABELS } from "../schemas/requests";
import type { RequestDetail } from "../types/requests";
import { RequestPanelFrame } from "./request-panel-frame";
import { WithdrawRequestButton } from "./withdraw-request-button";

type Props = {
  request: RequestDetail;
  /**
   * The Meet & Greet step of an approved request (MG-03, MG-04, MG-08), from its own module. It takes the place of
   * the status in plain words, and `state` names the step so the panel knows when it changed.
   */
  meet?: { content: ReactNode; state: string };
};

/** What each status means to the pet that sent the request: the news, then what comes of it. */
function words(request: RequestDetail): { lead: ReactNode; more?: ReactNode } {
  const home = request.home_profile.full_name;
  const expires = request.expires_at ? formatDate(request.expires_at) : "";
  const told: Record<RequestStatus, { lead: ReactNode; more?: ReactNode }> = {
    sent: {
      lead: `Waiting for ${home} to answer.`,
      more: expires ? `The request expires on ${expires} if there’s no answer.` : `A request expires after ${REQUEST_EXPIRY_DAYS} days without an answer.`,
    },
    on_hold: {
      lead: (
        <>
          <strong>Paused.</strong> Another of your requests is in process.
        </>
      ),
      more: `If that one ends without an adoption, this request goes back to Sent with a fresh ${REQUEST_EXPIRY_DAYS} days.`,
    },
    approved: {
      lead: (
        <>
          <strong>Approved!</strong> {home} would like to meet you.
        </>
      ),
      more: expires ? `Book a Meet & Greet by ${expires}, or the request expires.` : "Next comes booking a Meet & Greet.",
    },
    meet_scheduled: {
      lead: `Your Meet & Greet with ${home} is confirmed.`,
      more: "You can still withdraw before the decision.",
    },
    awaiting_decision: {
      lead: (
        <>
          <strong>The Meet & Greet time has passed.</strong> {home} is deciding.
        </>
      ),
      more: "You’ll be notified right away. You can still withdraw before the decision.",
    },
    adopted: {
      lead: <strong>You got Hired!</strong>,
      more: `${home} adopted you. Your profile is now an alumni profile, and your other open requests were closed.`,
    },
    declined: { lead: `${home} declined this request.` },
    not_adopted: { lead: `${home} decided not to adopt after the Meet & Greet.` },
    withdrawn: { lead: "You withdrew this request." },
    expired: { lead: `This request expired: ${REQUEST_EXPIRY_DAYS} days passed without an answer.`, more: "It no longer counts toward your open requests." },
    closed: { lead: "This request was closed automatically.", more: "That happens when a pet is adopted by another home, or an account is suspended." },
  };
  return told[request.status];
}

// The status panel of a request as the pet that sent it reads it (RQ-14 Sent, RQ-15 On Hold, RQ-17 Declined, and
// every other status in plain words): where it stands, what comes next, and the one thing the pet can do itself
// before the final decision, which is to withdraw (FR25). The API allows a withdrawal for every open status and
// refuses it for the rest, whatever this shows (SEC-FE-05). Once the request is approved, its Meet & Greet takes
// the lead here (`meet`).
export function PetRequestPanel({ request, meet }: Props) {
  const { lead, more } = words(request);
  const home = request.home_profile.full_name;
  const open = OPEN_REQUEST_STATUSES.includes(request.status);
  const message = open ? request.approval_message : request.decision_message;
  const reason =
    (request.decline_reason && DECLINE_REASON_LABELS[request.decline_reason]) ?? (request.withdraw_reason && WITHDRAW_REASON_LABELS[request.withdraw_reason]);

  return (
    <RequestPanelFrame state={`${request.status}:${meet?.state ?? ""}`}>
      <Card title="Status">
        <div className="flex flex-col gap-3">
          {meet ? (
            meet.content
          ) : (
            <>
              <p className="wrap-break-word">{lead}</p>
              {more && <p className="text-sm text-ink-muted">{more}</p>}
            </>
          )}

          {reason && (
            <p className="text-sm">
              <span className="text-ink-muted">Reason: </span>
              {reason}
            </p>
          )}
          {/* The human's own words, with an approval (RQ-12) or a decline (RQ-13), rendered as plain text (SEC-FE-01). */}
          {message && (
            <figure className="flex flex-col gap-1">
              <blockquote className="rounded-control bg-surface-sunken px-3 py-2 font-display wrap-break-word whitespace-pre-line">
                “{message}”
              </blockquote>
              <figcaption className="text-sm text-ink-muted">{home}</figcaption>
            </figure>
          )}
          {request.cooldown_until && (
            <p className="text-sm text-ink-muted">
              You can apply to {home} again on <strong className="text-ink">{formatDate(request.cooldown_until)}</strong>.
            </p>
          )}

          {open && <WithdrawRequestButton request={{ id: request.id, status: request.status, home_profile: request.home_profile }} />}
          {request.status === "adopted" && (
            <Link href={ROUTES.me} className={buttonClasses({ variant: "primary" })}>
              View my alumni profile
            </Link>
          )}
          {!open && request.status !== "adopted" && (
            <Link href={ROUTES.matches} className={buttonClasses({ className: "self-start" })}>
              Find other homes
            </Link>
          )}
        </div>
      </Card>
    </RequestPanelFrame>
  );
}
