import { type ApiClient, apiPath } from "@/lib/api/core";
import { isRecord, isText, readPage, unexpected } from "@/lib/api/readers";
import type { AdoptionRequest, DeclineReason, RequestHome, WithdrawReason } from "@/types/adoption-request";
import type { ApiResource } from "@/types/api";
import type { HomeType, HouseholdMember } from "@/types/home-profile";
import type { PetSummary } from "@/types/pet";
import { REQUEST_STATUSES, type RequestStatus } from "@/types/statuses";
import { REQUESTS_PAGE_SIZE, type RequestTab } from "../schemas/requests";
import type { RequestDetail, RequestPage, RequestStatusCounts, SentRequest } from "../types/requests";

// Adoption request calls for the pet that sends them (docs/api/adoption-and-meet-greet.md, RQ-03…RQ-08,
// RQ-14…RQ-17, FR24, FR25). The reads work from Server Components with `getServerApi()`; sending and withdrawing
// run in the browser. The pet is the session's own and the status is the system's, so neither is ever sent
// (SEC-AUTHZ-02, FR27). Every path with an id is built with apiPath (SEC-FE-08).

const LIST_PROBLEM = "We couldn't load your requests. Please try again.";
const DETAIL_PROBLEM = "We couldn't load this request. Please try again.";
const SEND_PROBLEM = "We couldn't tell whether your request was sent. Check My requests before sending it again.";
const WITHDRAW_PROBLEM = "We couldn't tell whether your request was withdrawn. Reload the page to see where it stands.";

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

const isPetSummary = (value: unknown): value is PetSummary => isRecord(value) && typeof value.id === "number" && isText(value.name);

/**
 * A request as the screens read it, or null when the answer isn't one. The status and the dates choose every badge
 * and button, so they are read strictly: a date that isn't text is "not there", a reason that isn't on the list is
 * no reason.
 */
function readRequest(value: unknown): AdoptionRequest | null {
  if (!isRecord(value) || typeof value.id !== "number" || !isStatus(value.status) || !isPetSummary(value.pet)) return null;
  const home = readHome(value.home_profile);
  if (!home) return null;

  return {
    id: value.id,
    status: value.status,
    pet: value.pet,
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

/** One tab of the signed-in pet's requests, newest first, with the count of every status (RQ-07, RQ-08). */
export async function getMyRequests(client: ApiClient, tab: RequestTab, page = 1): Promise<RequestPage> {
  const response = await client.get<unknown>("/adoption-requests", { query: { tab, page: page > 1 ? page : undefined, per_page: REQUESTS_PAGE_SIZE } });
  const rows = readPage(response, isRecord, LIST_PROBLEM);
  return { ...rows, data: readRows(rows.data), counts: readCounts((rows.meta as { status_counts?: unknown }).status_counts) };
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

/** One request. 404 for a request that isn't the caller's, like one that doesn't exist (SEC-AUTHZ-04). */
export async function getRequest(client: ApiClient, requestId: number): Promise<RequestDetail> {
  const data = (await client.get<ApiResource<unknown>>(apiPath`/adoption-requests/${requestId}`))?.data;
  const request = readRequest(data);
  if (!request || !isRecord(data)) throw unexpected(DETAIL_PROBLEM);
  return {
    ...request,
    match_score: typeof data.match_score === "number" ? data.match_score : null,
    cooldown_until: textOrNull(data.cooldown_until),
    is_thread_open: data.is_thread_open === true,
  };
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
