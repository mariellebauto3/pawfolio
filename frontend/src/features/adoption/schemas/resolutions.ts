import { RESOLUTION_ACTION_LABELS } from "@/constants/adoption-resolutions";
import { RESOLVE_PET_PARAM, RESOLVE_REQUEST_PARAM } from "@/constants/routes";
import { REQUEST_STATUS_LABELS } from "@/constants/statuses";
import { formatDate } from "@/lib/utils/format-date";
import type { Resolution, ResolutionAction } from "@/types/adoption-resolution";
import type { ResolutionChange, ResolveOptions, ResolveRequest } from "../types/resolutions";

// Resolve adoption issue (AL-07, AL-08, FR37): what its address says, which of the four actions the chosen request
// offers, and how a change is put into words. The API decides what applies and enforces the reason; these only keep
// the screen from offering what it would refuse (SEC-FE-05).

export const RESOLVE_SEARCH_PARAM = "q";

/** The search box takes this many characters, like the API's `q`. */
export const RESOLVE_SEARCH_MAX = 100;

/** The API takes a reason of this many characters. */
export const RESOLVE_REASON_MAX = 1000;

/** What each action does, under its name on the form (LoFi AL-07). */
export const RESOLUTION_ACTION_HINTS = {
  cancel_adoption: "The pet was returned. It goes back to Looking for a Home and the Furparent link is removed.",
  return_to_looking_for_a_home: "Ends the request in process without an adoption. Requests On Hold go back to Sent.",
  close_request: "Closes one request that is Sent or On Hold. Other requests are not affected.",
  reopen_meet_greet_booking: "The request goes back to Approved, so the pet can book a new slot.",
} as const satisfies Record<ResolutionAction, string>;

type UrlParams = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const idFrom = (value: string | undefined) => (value !== undefined && /^[1-9]\d{0,14}$/.test(value) ? Number(value) : null);

/**
 * What the page's URL asks for: a pet, one of its requests, or a search for a pet. Only plain ids go on to the API
 * (SEC-FE-08); anything else is read as "not given".
 */
export function resolveTargetFromUrl(params: UrlParams): { petId: number | null; requestId: number | null; search: string | undefined } {
  const search = first(params[RESOLVE_SEARCH_PARAM])?.trim().slice(0, RESOLVE_SEARCH_MAX);
  return { petId: idFrom(first(params[RESOLVE_PET_PARAM])), requestId: idFrom(first(params[RESOLVE_REQUEST_PARAM])), search: search || undefined };
}

/**
 * The request the form starts on: the one the URL names when it is the pet's, otherwise the only request anything
 * can be done about, otherwise none, and the admin picks.
 */
export function initialRequestId(options: ResolveOptions, wanted: number | null): number | null {
  if (wanted !== null && options.requests.some((request) => request.id === wanted)) return wanted;
  const actionable = new Set(options.actions.filter((option) => option.available).flatMap((option) => option.request_ids));
  return actionable.size === 1 ? [...actionable][0] : null;
}

/** "Ana Santos, Awaiting Decision, sent Sep 14, 2026 (#12)": a request in the "Related request" list. */
export function requestLabel(request: ResolveRequest): string {
  const sent = request.sent_at ? formatDate(request.sent_at) : "";
  return `${[request.home_name ?? "A home", REQUEST_STATUS_LABELS[request.status], sent && `sent ${sent}`].filter(Boolean).join(", ")} (#${request.id})`;
}

export type ActionChoice = {
  action: ResolutionAction;
  label: string;
  /** What it does, or why it can't be chosen now. */
  description: string;
  enabled: boolean;
};

/**
 * The four actions as the form lists them for the chosen request. One that doesn't apply stays on the list, greyed,
 * with the reason: an admin who came to cancel an adoption should read why they can't, not look for a missing option.
 */
export function actionChoices(options: ResolveOptions, requestId: number | null): ActionChoice[] {
  const homeOf = (id: number) => options.requests.find((request) => request.id === id)?.home_name ?? `request #${id}`;

  return options.actions.map((option) => {
    const label = RESOLUTION_ACTION_LABELS[option.action];
    const does = RESOLUTION_ACTION_HINTS[option.action];
    if (!option.available) return { action: option.action, label, enabled: false, description: option.unavailable_reason ?? "Not available for this pet right now." };
    // It changes the pet alone, or it is for the request that is chosen.
    if (option.request_ids.length === 0 || (requestId !== null && option.request_ids.includes(requestId))) return { action: option.action, label, enabled: true, description: does };

    const homes = option.request_ids.map(homeOf).join(", ");
    return { action: option.action, label, enabled: false, description: `${requestId === null ? "Choose the request it is for" : "Doesn’t apply to this request"}. It applies to the request to ${homes}.` };
  });
}

export type ResolutionErrors = { action?: string; reason?: string };

/** What the form would be refused for, in the words under each field. The API has the last word (SEC-INPUT-05). */
export function resolutionProblems(draft: { action: ResolutionAction | null; reason: string }): ResolutionErrors {
  const errors: ResolutionErrors = {};
  if (draft.action === null) errors.action = "Choose what to change.";
  const reason = draft.reason.trim();
  if (reason === "") errors.reason = "Enter a reason for this change.";
  else if (reason.length > RESOLVE_REASON_MAX) errors.reason = `Keep the reason to ${RESOLVE_REASON_MAX} characters or fewer.`;
  return errors;
}

/** What else moves with a change, each in a sentence, for the confirmation (AL-08). */
export function changeEffects(change: ResolutionChange): string[] {
  const effects: string[] = [];
  if (change.before.furparent_name && !change.after.furparent_name) {
    effects.push(`The Furparent link to ${change.before.furparent_name} is removed. ${change.before.furparent_name} keeps the Furparent label.`);
  }
  if (change.requests_restored > 0) {
    effects.push(change.requests_restored === 1 ? "1 request On Hold goes back to Sent, with a fresh 14 days." : `${change.requests_restored} requests On Hold go back to Sent, with a fresh 14 days.`);
  }
  if (change.meeting_ended) effects.push("The Meet & Greet that is booked for this request is ended.");
  return effects;
}

/**
 * Changes whenever what the pet offers changes. The form is keyed by it, so after a change is applied, or after
 * another admin changed the pet first, it starts over on where the pet stands now.
 */
export function resolveStateKey(options: ResolveOptions): string {
  return [options.pet.id, options.pet.status, ...options.requests.map((request) => `${request.id}:${request.status}`)].join("|");
}

/** "Luna and Ana Santos": who a resolution was about. */
export function resolutionParties(resolution: Pick<Resolution, "pet" | "home_name">): string {
  return [resolution.pet?.name ?? "A pet", resolution.home_name].filter(Boolean).join(" and ");
}
