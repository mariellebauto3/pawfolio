import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button-styles";
import { OPEN_REQUEST_STATUSES, REQUEST_EXPIRY_DAYS } from "@/constants/adoption-requests";
import { ROUTES, petPath } from "@/constants/routes";
import { formatDate } from "@/lib/utils/format-date";
import type { RequestStatus } from "@/types/statuses";
import { DECLINE_REASON_LABELS, WITHDRAW_REASON_LABELS } from "../schemas/requests";
import type { RequestDetail } from "../types/requests";
import { AnswerRequestButtons } from "./answer-request-buttons";
import { RequestPanelFrame } from "./request-panel-frame";

type Props = {
  request: RequestDetail;
  /**
   * The Meet & Greet step of an approved request (MG-05, MG-07), from its own module. It takes the place of the
   * status in plain words, and `state` names the step so the panel knows when it changed.
   */
  meet?: { content: ReactNode; state: string };
  /**
   * What an Adopted request offers (AL-04), from the modules that own it: the caretaker's contact details and the
   * adoption's details. It takes the place of the plain link to the alumni profile.
   */
  adopted?: ReactNode;
};

/** What each status means to the human the request was sent to: the news, then what comes of it. */
function words(request: RequestDetail): { lead: ReactNode; more?: ReactNode } {
  const pet = request.pet.name;
  const expires = request.expires_at ? formatDate(request.expires_at) : "";
  const told: Record<RequestStatus, { lead: ReactNode; more?: ReactNode }> = {
    sent: {
      lead: `${pet} wants to join your home.`,
      more: expires ? `Answer by ${expires}, or the request expires.` : `A request expires after ${REQUEST_EXPIRY_DAYS} days without an answer.`,
    },
    on_hold: {
      lead: (
        <>
          <strong>Paused.</strong> {pet} is in process with another home.
        </>
      ),
      more: `If that ends without an adoption, this request comes back to you as new, with a fresh ${REQUEST_EXPIRY_DAYS} days.`,
    },
    approved: {
      lead: `Waiting for ${pet} to book one of your Meet & Greet slots.`,
      more: expires ? `${pet} has until ${expires} to book.` : undefined,
    },
    meet_scheduled: { lead: `Your Meet & Greet with ${pet} is confirmed.` },
    awaiting_decision: {
      lead: (
        <>
          <strong>The Meet & Greet time has passed.</strong> It’s your decision now.
        </>
      ),
    },
    adopted: {
      lead: <strong>You’re a Furparent!</strong>,
      more: `${pet} is now Hired and linked to your profile for good.`,
    },
    declined: { lead: "You declined this request." },
    not_adopted: { lead: "You decided not to adopt after the Meet & Greet." },
    withdrawn: { lead: `${pet} withdrew this request.` },
    expired: { lead: `This request expired: ${REQUEST_EXPIRY_DAYS} days passed without an answer.` },
    closed: { lead: "This request was closed automatically.", more: "That happens when a pet is adopted by another home, or an account is suspended." },
  };
  return told[request.status];
}

// The action panel of a request as the human it was sent to reads it (RQ-11 and every later status in plain
// words): where it stands, and Approve and Decline while it is new (FR10). The API allows an answer only to a
// Sent request, whatever this shows (SEC-FE-05). Once it is approved, its Meet & Greet takes the lead here
// (`meet`), up to the decision after it (MG-11). An Adopted request is the record of the adoption (AL-04).
export function HumanRequestPanel({ request, meet, adopted }: Props) {
  const { lead, more } = words(request);
  const pet = request.pet.name;
  // While it is open, what the human wrote with the approval; once it has ended, what they wrote with the ending.
  const message = OPEN_REQUEST_STATUSES.includes(request.status) ? request.approval_message : request.decision_message;
  const reason =
    (request.decline_reason && DECLINE_REASON_LABELS[request.decline_reason]) ?? (request.withdraw_reason && WITHDRAW_REASON_LABELS[request.withdraw_reason]);

  return (
    <RequestPanelFrame state={`${request.status}:${meet?.state ?? ""}`}>
      <Card title="Your action">
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
          {/* The human's own words, as the pet reads them (RQ-12, RQ-13), rendered as plain text (SEC-FE-01). */}
          {message && (
            <figure className="flex flex-col gap-1">
              <blockquote className="rounded-control bg-surface-sunken px-3 py-2 font-display wrap-break-word whitespace-pre-line">“{message}”</blockquote>
              <figcaption className="text-sm text-ink-muted">Your message to {pet}</figcaption>
            </figure>
          )}
          {request.cooldown_until && (
            <p className="text-sm text-ink-muted">
              {pet} can’t send you another request until <strong className="text-ink">{formatDate(request.cooldown_until)}</strong>.
            </p>
          )}

          {request.status === "sent" && <AnswerRequestButtons request={{ id: request.id, petName: pet }} />}
          {request.status === "approved" && !meet && (
            <Link href={ROUTES.availability} className={buttonClasses({ size: "sm", className: "self-start" })}>
              Manage availability
            </Link>
          )}
          {request.status === "adopted" &&
            (adopted ?? (
              <Link href={petPath(request.pet.id)} className={buttonClasses({ variant: "primary" })}>
                View {pet}’s alumni profile
              </Link>
            ))}
        </div>
      </Card>
    </RequestPanelFrame>
  );
}
