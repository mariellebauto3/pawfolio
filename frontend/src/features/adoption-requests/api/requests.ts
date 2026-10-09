import { type ApiClient, apiPath } from "@/lib/api/core";
import { isRecord, isText, readPage, unexpected } from "@/lib/api/readers";
import type { AdoptionRequest, DeclineReason, RequestHome, RequestPet, WithdrawReason } from "@/types/adoption-request";
import type { ApiResource } from "@/types/api";
import type { HomeType, HouseholdMember } from "@/types/home-profile";
import { REQUEST_STATUSES, type RequestStatus } from "@/types/statuses";
import { type InboxTab, REQUESTS_PAGE_SIZE, type RequestTab } from "../schemas/requests";
import type { RequestDetail, RequestPage, RequestStatusCounts, SentRequest } from "../types/requests";

// Adoption request calls, for the pet that sends them and the human that answers them
// (docs/api/adoption-and-meet-greet.md, RQ-03…RQ-17, FR10, FR24, FR25). The reads work from Server Components with
// `getServerApi()`; sending, withdrawing, approving and declining run in the browser. Whose request it is comes
// from the session and the status is the system's, so neither is ever sent (SEC-AUTHZ-02, FR27). Every path with
// an id is built with apiPath (SEC-FE-08).

const LIST_PROBLEM = "We couldn't load your requests. Please try again.";
const DETAIL_PROBLEM = "We couldn't load this request. Please try again.";
const SEND_PROBLEM = "We couldn't tell whether your request was sent. Check My requests before sending it again.";
const WITHDRAW_PROBLEM = "We couldn't tell whether your request was withdrawn. Reload the page to see where it stands.";
const ANSWER_PROBLEM = "We couldn't tell whether your answer went through. Reload the page to see where the request stands.";

const DECLINE_REASONS: readonly unknown[] = ["not_right_fit", "not_adopting_now", "another_pet_joining", "other"] satisfies DeclineReason[];
const WITHDRAW_REASONS: readonly unknown[] = ["found_better_match", "caretaker_cant_make_schedule", "pet_no_longer_available", "other"] satisfies WithdrawReason[];
const HOME_TYPES: readonly unknown[] = ["house", "condo", "apartment", "townhouse"] satisfies HomeType[];

const textOrNull = (value: unknown) => (isText(value) && value !== "" ? value : null);
const isStatus = (value: unknown): value is RequestStatus => (REQUEST_STATUSES as readonly unknown[]).includes(value);

/** The home on a request: its name, and public facts only. Null when it isn't one. */
function readHome(value: unknown): RequestHome | null {
  if (!isRecord(value) || typeof value.id !== "number" || !isText(value.full_name)) return null;
  return {
    id: value.id,
    full_name: value.full_name,
    city: isText(value.city) ? value.city : "",
    profile_photo_url: textOrNull(value.profile_photo_url),
    is_furparent: value.is_furparent === true,
    home_type: HOME_TYPES.includes(value.home_type) ? (value.home_type as HomeType) : null,
    household_members: Array.isArray(value.household_members) ? (value.household_members.filter(isText) as HouseholdMember[]) : [],
  };
}

/** The pet on a request: its name and public summary. An age that isn't a number is "not there". */
function readPet(value: unknown): RequestPet | null {
  if (!isRecord(value) || typeof value.id !== "number" || !isText(value.name)) return null;
  const age = value.approximate_age_months;
  return { ...(value as RequestPet), approximate_age_months: typeof age === "number" && Number.isFinite(age) ? age : null };
}

/**
 * A request as the screens read it, or null when the answer isn't one. The status and the dates choose every badge
 * and button, so they are read strictly: a date that isn't text is "not there", a reason that isn't on the list is
 * no reason.
 */
function readRequest(value: unknown): AdoptionRequest | null {
  if (!isRecord(value) || typeof value.id !== "number" || !isStatus(value.status)) return null;
  const pet = readPet(value.pet);
  const home = readHome(value.home_profile);
  if (!pet || !home) return null;

  return {
    id: value.id,
    status: value.status,
    pet,
    home_profile: home,
    cover_letter: isText(value.cover_letter) ? value.cover_letter : "",
    caretaker_notes: textOrNull(value.caretaker_notes),
    approval_message: textOrNull(value.approval_message),
    decline_reason: DECLINE_REASONS.includes(value.decline_reason) ? (value.decline_reason as DeclineReason) : null,
    decision_message: textOrNull(value.decision_message),
    withdraw_reason: WITHDRAW_REASONS.includes(value.withdraw_reason) ? (value.withdraw_reason as WithdrawReason) : null,
    sent_at: textOrNull(value.sent_at),
    expires_at: textOrNull(value.expires_at),
    approved_at: textOrNull(value.approved_at),
    meet_scheduled_at: textOrNull(value.meet_scheduled_at),
    awaiting_decision_at: textOrNull(value.awaiting_decision_at),
    overdue_flagged_at: textOrNull(value.overdue_flagged_at),
    closed_at: textOrNull(value.closed_at),
  };
}

function readCounts(value: unknown): RequestStatusCounts {
  if (!isRecord(value)) return {};
  const counts: RequestStatusCounts = {};
  for (const status of REQUEST_STATUSES) {
    const count = value[status];
    if (typeof count === "number" && Number.isInteger(count) && count > 0) counts[status] = count;
  }
  return counts;
}

/** Rows that aren't requests are left out, as on every list. */
function readRows(rows: unknown[]): AdoptionRequest[] {
  return rows.map(readRequest).filter((request): request is AdoptionRequest => request !== null);
}

/** One tab of the caller's own requests, newest first, with the count of every status whatever the tab. */
async function listRequests(client: ApiClient, tab: string, page: number): Promise<RequestPage> {
  const response = await client.get<unknown>("/adoption-requests", { query: { tab, page: page > 1 ? page : undefined, per_page: REQUESTS_PAGE_SIZE } });
  const rows = readPage(response, isRecord, LIST_PROBLEM);
  return { ...rows, data: readRows(rows.data), counts: readCounts((rows.meta as { status_counts?: unknown }).status_counts) };
}

/** One tab of the signed-in pet's requests (RQ-07, RQ-08). */
export function getMyRequests(client: ApiClient, tab: RequestTab, page = 1): Promise<RequestPage> {
  return listRequests(client, tab, page);
}

/** One tab of the signed-in human's inbox: the requests pets sent to their home (RQ-09, RQ-10). */
export function getInbox(client: ApiClient, tab: InboxTab, page = 1): Promise<RequestPage> {
  return listRequests(client, tab === "in-progress" ? "in_progress" : tab, page);
}

/**
 * The signed-in pet's latest requests, newest first, for `applyStateFor` (DS-07, RQ-03). What decides Apply is
 * recent by nature: a pet has at most three open requests, and a cooldown lasts 30 days, so the newest page holds
 * them.
 */
export async function getOwnRequests(client: ApiClient): Promise<AdoptionRequest[]> {
  const response = await client.get<unknown>("/adoption-requests", { query: { per_page: 50 } });
  return readRows(isRecord(response) && Array.isArray(response.data) ? response.data : []);
}

/**
 * One request, and whatever `readMore` reads from the same answer: the Meet & Greet that rides along on it belongs
 * to its own module, which hands its reader in, so the page makes one call for both. 404 for a request that isn't
 * the caller's, like one that doesn't exist (SEC-AUTHZ-04).
 */
export async function getRequestWith<More>(
  client: ApiClient,
  requestId: number,
  readMore: (data: Record<string, unknown>) => More,
): Promise<{ request: RequestDetail; more: More }> {
  const data = (await client.get<ApiResource<unknown>>(apiPath`/adoption-requests/${requestId}`))?.data;
  const request = readRequest(data);
  if (!request || !isRecord(data)) throw unexpected(DETAIL_PROBLEM);
  const detail = {
    ...request,
    match_score: typeof data.match_score === "number" ? data.match_score : null,
    cooldown_until: textOrNull(data.cooldown_until),
  };
  return { request: detail, more: readMore(data) };
}

/** One request, as far as the request screens read it. */
export async function getRequest(client: ApiClient, requestId: number): Promise<RequestDetail> {
  return (await getRequestWith(client, requestId, () => null)).request;
}

/**
 * Sends an adoption request to a home (RQ-03). 422 with a message per field, or 409 with a message to show when a
 * rule stops it: `open_request_limit` (RQ-05), `request_cooldown` (RQ-06), `pet_in_process`, `request_already_open`,
 * `not_open_to_adopt`, `pet_resume_draft`, `already_adopted`. 404 for a home the pet may not open.
 */
export async function sendRequest(
  client: ApiClient,
  homeProfileId: number,
  body: { cover_letter: string; caretaker_notes: string | null },
): Promise<SentRequest> {
  const response = await client.post<unknown>(apiPath`/home-profiles/${homeProfileId}/adoption-requests`, body);
  const request = isRecord(response) ? readRequest(response.data) : null;
  if (!request) throw unexpected(SEND_PROBLEM);
  const open = isRecord(response) && isRecord(response.meta) ? response.meta.open_requests : null;
  return { request, openRequests: typeof open === "number" && Number.isInteger(open) && open > 0 ? open : null };
}

/**
 * Withdraws a request the pet sent (RQ-16, FR25), with an optional reason from the list. 409
 * `request_already_closed` when it ended in the meantime.
 */
export async function withdrawRequest(client: ApiClient, requestId: number, reason: WithdrawReason | null): Promise<AdoptionRequest> {
  const data = (await client.post<ApiResource<unknown>>(apiPath`/adoption-requests/${requestId}/withdraw`, { withdraw_reason: reason }))?.data;
  const request = readRequest(data);
  if (!request) throw unexpected(WITHDRAW_PROBLEM);
  return request;
}

/** The request after an answer, with the cooldown a decline starts. */
function readAnswered(data: unknown): RequestDetail {
  const request = readRequest(data);
  if (!request || !isRecord(data)) throw unexpected(ANSWER_PROBLEM);
  return {
    ...request,
    match_score: typeof data.match_score === "number" ? data.match_score : null,
    cooldown_until: textOrNull(data.cooldown_until),
  };
}

/**
 * Approves a request sent to the human's home (RQ-12, FR10), with an optional message. The pet becomes In Process
 * and its other open requests go On Hold. 409 with a message to show when it can't be approved any more:
 * `invalid_request_state` (no longer Sent), `request_expired`, `pet_unavailable` (another home was first).
 */
export async function approveRequest(client: ApiClient, requestId: number, message: string | null): Promise<RequestDetail> {
  return readAnswered((await client.post<ApiResource<unknown>>(apiPath`/adoption-requests/${requestId}/approve`, { approval_message: message }))?.data);
}

/**
 * Declines a request (RQ-13, FR10), with an optional reason from the list and an optional message. The pet can't
 * apply to this home again for 30 days. 409 `invalid_request_state` when it was answered or ended in the meantime.
 */
export async function declineRequest(
  client: ApiClient,
  requestId: number,
  answer: { reason: DeclineReason | null; message: string | null },
): Promise<RequestDetail> {
  const body = { decline_reason: answer.reason, decision_message: answer.message };
  return readAnswered((await client.post<ApiResource<unknown>>(apiPath`/adoption-requests/${requestId}/decline`, body))?.data);
}
