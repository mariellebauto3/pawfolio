import { CLOSED_REQUEST_STATUSES, IN_PROCESS_REQUEST_STATUSES, OPEN_REQUEST_STATUSES } from "@/constants/adoption-requests";
import { ROUTES } from "@/constants/routes";
import type { DeclineReason, WithdrawReason } from "@/types/adoption-request";
import type { RequestStatus } from "@/types/statuses";
import type { RequestStatusCounts } from "../types/requests";

// The rules of sending and listing adoption requests that the pet's screens need (RQ-03, RQ-07, RQ-08, RQ-16;
// docs/api/adoption-and-meet-greet.md). The API's Form Requests are the authority; these mirror their limits and
// messages so the form answers at once (SEC-INPUT-05).

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
