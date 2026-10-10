import type { StatusName } from "@/constants/status-badges";
import { REQUEST_STATUS_LABELS } from "@/constants/statuses";
import { formatDate } from "@/lib/utils/format-date";
import type { AdoptionRequest } from "@/types/adoption-request";
import type { IsoDateTime } from "@/types/api";
import type { RequestStatus } from "@/types/statuses";

// How a request's status and dates are told to its readers: the pet that sent it (RQ-07, RQ-08, RQ-14…RQ-17), the
// human it was sent to (RQ-09…RQ-11), and an admin monitoring it (RQ-19). The status and every date are the API's;
// nothing here decides one (FR27).

/** Who is reading: each side is "you" in its own history, and an admin reads both by name. */
export type RequestReader = "pet" | "human" | "admin";

/** The path every request detail shows (proposal §5.3). The last step is the pet's own status once it is adopted. */
export const REQUEST_STEPS = ["Sent", "Approved", "Meet Scheduled", "Awaiting Decision", "Adopted — Hired"];

const STEP_OF: Partial<Record<RequestStatus, number>> = { sent: 0, on_hold: 0, approved: 1, meet_scheduled: 2, awaiting_decision: 3, adopted: 4 };

/** Where a request stands on that path, 0 to 4. Null once it ended without an adoption: there is no step to show. */
export function requestStep(status: RequestStatus): number | null {
  return STEP_OF[status] ?? null;
}

const on = (label: string, date: IsoDateTime | null) => {
  const text = date ? formatDate(date) : "";
  return text ? `${label} ${text}` : null;
};

/** The dates under a name in My requests and in the inbox: when it was sent, then the latest thing that happened to it. */
export function requestRowDates(request: AdoptionRequest): string[] {
  const latest: Partial<Record<RequestStatus, string | null>> = {
    sent: on("Expires", request.expires_at),
    approved: on("Approved", request.approved_at),
    meet_scheduled: on("Meet & Greet confirmed", request.meet_scheduled_at),
    awaiting_decision: on("Meeting time passed", request.awaiting_decision_at),
  };
  const ended = request.closed_at ? on(REQUEST_STATUS_LABELS[request.status], request.closed_at) : null;
  return [on("Sent", request.sent_at), request.status in latest ? latest[request.status] : ended].filter((part): part is string => Boolean(part));
}

/** One line of a request's history, for the shared Timeline. */
export type RequestEvent = {
  id: string;
  title: string;
  at: IsoDateTime;
  /** The status this moved the request to. */
  status?: StatusName;
  /** Still to come, such as the day a Sent request expires. */
  upcoming?: boolean;
};

/** The two names a history is told with. */
type Names = { pet: string; home: string };

/** How each step reads to each side. */
const STEPS: Record<RequestReader, { sent: (n: Names) => string; approved: (n: Names) => string; expires: (n: Names) => string }> = {
  pet: {
    sent: () => "You sent the request",
    approved: ({ home }) => `${home} approved the request`,
    expires: ({ home }) => `Expires if ${home} hasn’t answered`,
  },
  human: {
    sent: ({ pet }) => `${pet} sent the request`,
    approved: () => "You approved the request",
    expires: () => "Expires if you haven’t answered",
  },
  admin: {
    sent: ({ pet }) => `${pet} sent the request`,
    approved: ({ home }) => `${home} approved the request`,
    expires: ({ home }) => `Expires if ${home} hasn’t answered`,
  },
};

/** How each ending reads to each side. */
const ENDINGS: Record<RequestReader, Partial<Record<RequestStatus, (n: Names) => string>>> = {
  pet: {
    adopted: ({ home }) => `${home} adopted you`,
    declined: ({ home }) => `${home} declined the request`,
    not_adopted: ({ home }) => `${home} decided not to adopt`,
    withdrawn: () => "You withdrew the request",
    expired: () => "The request expired without an answer",
    closed: () => "The request was closed",
  },
  human: {
    adopted: ({ pet }) => `You adopted ${pet}`,
    declined: () => "You declined the request",
    not_adopted: () => "You decided not to adopt",
    withdrawn: ({ pet }) => `${pet} withdrew the request`,
    expired: () => "The request expired without an answer",
    closed: () => "The request was closed",
  },
  admin: {
    adopted: ({ pet, home }) => `${home} adopted ${pet}`,
    declined: ({ home }) => `${home} declined the request`,
    not_adopted: ({ home }) => `${home} decided not to adopt`,
    withdrawn: ({ pet }) => `${pet} withdrew the request`,
    expired: () => "The request expired without an answer",
    closed: () => "The request was closed",
  },
};

/**
 * A request's history as one side reads it, oldest first, from the dates the API keeps for each milestone. A step
 * with no date isn't shown, so nothing is made up; On Hold has none, and is told by the badge and the status panel.
 */
export function requestTimeline(request: AdoptionRequest, reader: RequestReader = "pet"): RequestEvent[] {
  const names = { pet: request.pet.name, home: request.home_profile.full_name };
  const steps = STEPS[reader];
  const events: (RequestEvent | null)[] = [
    request.sent_at ? { id: "sent", title: steps.sent(names), at: request.sent_at, status: "Sent" } : null,
    request.approved_at ? { id: "approved", title: steps.approved(names), at: request.approved_at, status: "Approved" } : null,
    request.meet_scheduled_at ? { id: "meet_scheduled", title: "The Meet & Greet was confirmed", at: request.meet_scheduled_at, status: "Meet Scheduled" } : null,
    request.awaiting_decision_at
      ? { id: "awaiting_decision", title: "The meeting time passed", at: request.awaiting_decision_at, status: "Awaiting Decision" }
      : null,
  ];

  const ending = ENDINGS[reader][request.status];
  if (ending && request.closed_at) {
    events.push({ id: "ended", title: ending(names), at: request.closed_at, status: REQUEST_STATUS_LABELS[request.status] });
  }
  if (request.status === "sent" && request.expires_at) {
    events.push({ id: "expires", title: steps.expires(names), at: request.expires_at, upcoming: true });
  }

  return events.filter((event): event is RequestEvent => event !== null && !Number.isNaN(new Date(event.at).getTime()));
}

/**
 * The badge of a row in the human's inbox (RQ-09, RQ-10): the two statuses that wait on the human are named by
 * what they ask for, and every other one by its own name.
 */
export function inboxBadge(status: RequestStatus): { label: string; needsAnswer: boolean } {
  if (status === "sent") return { label: "New", needsAnswer: true };
  if (status === "awaiting_decision") return { label: "Decision needed", needsAnswer: true };
  return { label: REQUEST_STATUS_LABELS[status], needsAnswer: false };
}
