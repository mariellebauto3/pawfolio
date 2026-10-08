import { CLOSED_REQUEST_STATUSES, IN_PROCESS_REQUEST_STATUSES, OPEN_REQUEST_STATUSES } from "@/constants/adoption-requests";
import { ROUTES } from "@/constants/routes";
import type { DeclineReason, WithdrawReason } from "@/types/adoption-request";
import type { RequestStatus } from "@/types/statuses";
import type { RequestStatusCounts } from "../types/requests";

// The rules of sending, listing and answering adoption requests that the screens need (RQ-03, RQ-07…RQ-10, RQ-12,
// RQ-13, RQ-16; docs/api/adoption-and-meet-greet.md). The API's Form Requests are the authority; these mirror
// their limits and messages so the forms answer at once (SEC-INPUT-05).

/** "Why I'd fit your home", after trimming (RQ-03). */
export const COVER_LETTER_MIN = 50;
export const COVER_LETTER_MAX = 600;
export const CARETAKER_NOTES_MAX = 600;

/** The message for a cover letter that can't be sent, or null when it can. */
export function validateCoverLetter(typed: string): string | null {
  const length = typed.trim().length;
  return length < COVER_LETTER_MIN || length > COVER_LETTER_MAX ? `Write between ${COVER_LETTER_MIN} and ${COVER_LETTER_MAX} characters.` : null;
}

export function validateCaretakerNotes(typed: string): string | null {
  return typed.trim().length > CARETAKER_NOTES_MAX ? `Keep the notes to ${CARETAKER_NOTES_MAX} characters or fewer.` : null;
}

/** The request as it is sent: both trimmed, and no notes at all when they are empty. */
export function requestBody(letter: string, notes: string): { cover_letter: string; caretaker_notes: string | null } {
  const trimmed = notes.trim();
  return { cover_letter: letter.trim(), caretaker_notes: trimmed === "" ? null : trimmed };
}

/** The reasons the Withdraw dialog offers (RQ-16), as the API's enum names them. */
export const WITHDRAW_REASON_LABELS = {
  found_better_match: "Found a better match",
  caretaker_cant_make_schedule: "Caretaker can’t make the schedule",
  pet_no_longer_available: "Pet is no longer available",
  other: "Other",
} as const satisfies Record<WithdrawReason, string>;

/** The reasons a human may give for declining (RQ-13), read by the pet on a Declined request (RQ-17). */
export const DECLINE_REASON_LABELS = {
  not_right_fit: "Not the right fit for our home",
  not_adopting_now: "We’re not adopting right now",
  another_pet_joining: "Another pet is joining our family",
  other: "Other",
} as const satisfies Record<DeclineReason, string>;

/** A human's message with an approval (RQ-12) or a decline (RQ-13), after trimming. */
export const ANSWER_MESSAGE_MAX = 600;

export function validateAnswerMessage(typed: string): string | null {
  return typed.trim().length > ANSWER_MESSAGE_MAX ? `Keep the message to ${ANSWER_MESSAGE_MAX} characters or fewer.` : null;
}

/** The message as it is sent: trimmed, and nothing at all when it is empty. */
export function answerMessage(typed: string): string | null {
  const message = typed.trim();
  return message === "" ? null : message;
}

// My requests (RQ-07, RQ-08): two tabs in `?tab=`, a page at a time in `?page=`.

export const REQUEST_TABS = ["active", "closed"] as const;
export type RequestTab = (typeof REQUEST_TABS)[number];

/** Requests on one page of a tab. */
export const REQUESTS_PAGE_SIZE = 10;

/** The tab named in the URL; anything else is Active, which stays out of the URL. */
export function requestTabFromUrl(value: string | string[] | undefined): RequestTab {
  const text = Array.isArray(value) ? value[0] : value;
  return text === "closed" ? "closed" : "active";
}

export function requestsHref(tab: RequestTab = "active", page = 1): string {
  const query = new URLSearchParams();
  if (tab !== "active") query.set("tab", tab);
  if (page > 1) query.set("page", String(page));
  const text = query.toString();
  return text ? `${ROUTES.requests}?${text}` : ROUTES.requests;
}

// The human's inbox on the same address (RQ-09, RQ-10): three tabs that share out every request sent to the home.

export const INBOX_TABS = ["new", "in-progress", "closed"] as const;
export type InboxTab = (typeof INBOX_TABS)[number];

/** The tab named in the URL; anything else is New, which stays out of the URL. */
export function inboxTabFromUrl(value: string | string[] | undefined): InboxTab {
  const text = Array.isArray(value) ? value[0] : value;
  return (INBOX_TABS as readonly unknown[]).includes(text) ? (text as InboxTab) : "new";
}

export function inboxHref(tab: InboxTab = "new", page = 1): string {
  const query = new URLSearchParams();
  if (tab !== "new") query.set("tab", tab);
  if (page > 1) query.set("page", String(page));
  const text = query.toString();
  return text ? `${ROUTES.requests}?${text}` : ROUTES.requests;
}

const sum = (counts: RequestStatusCounts, statuses: readonly RequestStatus[]) =>
  statuses.reduce((total, status) => total + (counts[status] ?? 0), 0);

/** How many of the pet's requests are open, in process and closed, from the API's count of each status. */
export function requestTotals(counts: RequestStatusCounts): { open: number; inProcess: number; closed: number } {
  return {
    open: sum(counts, OPEN_REQUEST_STATUSES),
    inProcess: sum(counts, IN_PROCESS_REQUEST_STATUSES),
    closed: sum(counts, CLOSED_REQUEST_STATUSES),
  };
}

/** The same count shared out over the inbox's tabs. In progress is everything open that isn't new, On Hold included. */
export function inboxTotals(counts: RequestStatusCounts): Record<InboxTab, number> {
  const fresh = counts.sent ?? 0;
  return { new: fresh, "in-progress": sum(counts, OPEN_REQUEST_STATUSES) - fresh, closed: sum(counts, CLOSED_REQUEST_STATUSES) };
}
