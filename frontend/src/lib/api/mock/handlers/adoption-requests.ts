import {
  CLOSED_REQUEST_STATUSES,
  COOLDOWN_REQUEST_STATUSES,
  IN_PROCESS_REQUEST_STATUSES,
  MAX_OPEN_REQUESTS,
  OPEN_REQUEST_STATUSES,
  REQUEST_COOLDOWN_DAYS,
  REQUEST_EXPIRY_DAYS,
} from "@/constants/adoption-requests";
import type { QueryValue } from "@/lib/api/core";
import { ADOPTION_REQUESTS, homeProfileSummary, petSummary } from "@/lib/api/mock/fixtures/adoption-requests";
import { HOME_PROFILES } from "@/lib/api/mock/fixtures/home-profiles";
import { MATCH_SCORES } from "@/lib/api/mock/fixtures/match-scores";
import { PETS } from "@/lib/api/mock/fixtures/pets";
import { type MockContext, type MockResult, type MockRoute, fail, ok, paginate, route, validationFailed } from "@/lib/api/mock/router";
import type { Account } from "@/types/account";
import type { AdoptionRequest, WithdrawReason } from "@/types/adoption-request";
import { REQUEST_STATUSES, type RequestStatus } from "@/types/statuses";

// Adoption requests in mock mode (docs/api/adoption-and-meet-greet.md), with the pet's side answered as the API
// answers it: sending within the rules of proposal §5.5, My requests by tab with the count of each status, one
// request, and withdrawing. What is sent or withdrawn lives in memory, so it is back to the fixtures after a
// reload, and a page rendered on the server doesn't see what the browser changed.

const COVER_LETTER_MIN = 50;
const COVER_LETTER_MAX = 600;
const CARETAKER_NOTES_MAX = 600;
const DAY_MS = 24 * 60 * 60 * 1000;
const WITHDRAW_REASONS: readonly unknown[] = ["found_better_match", "caretaker_cant_make_schedule", "pet_no_longer_available", "other"] satisfies WithdrawReason[];
const TABS: Record<string, readonly RequestStatus[]> = {
  active: OPEN_REQUEST_STATUSES,
  new: ["sent"],
  in_progress: IN_PROCESS_REQUEST_STATUSES,
  closed: CLOSED_REQUEST_STATUSES,
};

const NOT_FOUND = "We couldn't find that request.";

/** Only the pet, the human on the request and admins may see it (SEC-AUTHZ-03). */
function canView(request: AdoptionRequest, account: Account | null): boolean {
  if (!account) return false;
  if (account.role === "admin") return true;
  if (account.role === "pet") return request.pet.id === account.profile_id;
  return request.home_profile.id === account.profile_id;
}

const isOwn = (request: AdoptionRequest, account: Account) =>
  account.role === "pet" ? request.pet.id === account.profile_id : request.home_profile.id === account.profile_id;

const listOf = (value: QueryValue) =>
  String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

/** 30 days after the pet's last Declined or Not Adopted result with this home; null once that has passed. */
function cooldownEnd(petId: number, homeProfileId: number): number | null {
  const ends = ADOPTION_REQUESTS.filter(
    (request) => request.pet.id === petId && request.home_profile.id === homeProfileId && COOLDOWN_REQUEST_STATUSES.includes(request.status) && request.closed_at,
  ).map((request) => new Date(request.closed_at as string).getTime() + REQUEST_COOLDOWN_DAYS * DAY_MS);
  const latest = Math.max(...ends, 0);
  return latest > Date.now() ? latest : null;
}

/** What `GET /adoption-requests/{id}` adds to the request. Nothing private: no Meet & Greet is confirmed here. */
function withDetails(request: AdoptionRequest) {
  const cooldown = COOLDOWN_REQUEST_STATUSES.includes(request.status) && request.closed_at ? new Date(request.closed_at).getTime() + REQUEST_COOLDOWN_DAYS * DAY_MS : 0;
  return {
    ...request,
    match_score: MATCH_SCORES[`${request.pet.id}:${request.home_profile.id}`] ?? null,
    cooldown_until: cooldown > Date.now() ? new Date(cooldown).toISOString() : null,
    is_thread_open: IN_PROCESS_REQUEST_STATUSES.includes(request.status),
    contact_unlocked: false,
    contacts: null,
  };
}

type NewRequestBody = { home_profile_id?: unknown; cover_letter?: unknown; caretaker_notes?: unknown };

/** Sending a request (RQ-03), with the checks in the API's order. `homeId` comes from the path or from the body. */
function send({ body, account }: MockContext, homeId: unknown): MockResult {
  if (account?.role !== "pet" || account.profile_id === null) return fail(403, "This action is unauthorized.");
  const petId = account.profile_id;
  const { cover_letter, caretaker_notes } = (body ?? {}) as NewRequestBody;

  const errors: Record<string, string> = {};
  if (!Number.isInteger(Number(homeId)) || Number(homeId) < 1) errors.home_profile_id = "Choose a home to apply to.";
  const letter = typeof cover_letter === "string" ? cover_letter.trim() : "";
  if (letter.length < COVER_LETTER_MIN || letter.length > COVER_LETTER_MAX) {
    errors.cover_letter = `Write between ${COVER_LETTER_MIN} and ${COVER_LETTER_MAX} characters.`;
  }
  const notes = typeof caretaker_notes === "string" ? caretaker_notes.trim() : "";
  if ((caretaker_notes !== undefined && caretaker_notes !== null && typeof caretaker_notes !== "string") || notes.length > CARETAKER_NOTES_MAX) {
    errors.caretaker_notes = `Keep the notes to ${CARETAKER_NOTES_MAX} characters or fewer.`;
  }
  if (Object.keys(errors).length) return validationFailed(errors);

  const between = (request: AdoptionRequest) => request.pet.id === petId && request.home_profile.id === Number(homeId);
  // A home the pet may not open answers like one that doesn't exist (SEC-AUTHZ-04): Open to Adopt is off and the
  // pet has no request with it.
  const home = HOME_PROFILES.find((h) => h.id === Number(homeId) && (h.is_open_to_adopt || ADOPTION_REQUESTS.some(between)));
  const pet = PETS.find((p) => p.id === petId);
  if (!home || !pet) return fail(404, "We couldn't find that Home Profile.");

  const inProcess = fail(409, "You already have a request in process. You can apply to other homes if it ends without an adoption.", { code: "pet_in_process" });
  if (pet.status === "draft") return fail(409, "Publish your resume before you send an adoption request.", { code: "pet_resume_draft" });
  if (pet.status === "adopted_hired") return fail(409, "You've been adopted, so you can't send adoption requests.", { code: "already_adopted" });
  if (pet.status === "in_process") return inProcess;

  const open = ADOPTION_REQUESTS.filter((request) => request.pet.id === petId && OPEN_REQUEST_STATUSES.includes(request.status));
  if (open.some(between)) return fail(409, `You already have an open request with ${home.full_name}.`, { code: "request_already_open" });

  const cooldown = cooldownEnd(petId, home.id);
  if (cooldown !== null) {
    const day = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(cooldown);
    return fail(409, `You can apply to ${home.full_name} again after ${day} (30-day cooldown).`, { code: "request_cooldown" });
  }
  if (open.length >= MAX_OPEN_REQUESTS) {
    return fail(409, `You already have ${MAX_OPEN_REQUESTS} open requests. Wait for an answer or withdraw one first.`, { code: "open_request_limit" });
  }
  if (open.some((request) => IN_PROCESS_REQUEST_STATUSES.includes(request.status))) return inProcess;
  if (!home.is_open_to_adopt) return fail(409, `${home.full_name} isn't open to adopt right now.`, { code: "not_open_to_adopt" });

  const now = Date.now();
  const created: AdoptionRequest = {
    id: Math.max(0, ...ADOPTION_REQUESTS.map((request) => request.id)) + 1,
    status: "sent",
    pet: petSummary(petId),
    home_profile: homeProfileSummary(home.id),
    cover_letter: letter,
    caretaker_notes: notes === "" ? null : notes,
    approval_message: null,
    decline_reason: null,
    decision_message: null,
    withdraw_reason: null,
    sent_at: new Date(now).toISOString(),
    expires_at: new Date(now + REQUEST_EXPIRY_DAYS * DAY_MS).toISOString(),
    approved_at: null,
    meet_scheduled_at: null,
    awaiting_decision_at: null,
    closed_at: null,
  };
  ADOPTION_REQUESTS.push(created);
  return { status: 201, body: { data: created, meta: { open_requests: open.length + 1, max_open_requests: MAX_OPEN_REQUESTS } } };
}

export const adoptionRequestRoutes: MockRoute[] = [
  // The caller's own requests, newest first: a pet's My requests (RQ-07, RQ-08) or a human's inbox.
  route("GET", "/adoption-requests", ({ query, account }) => {
    if (!account || account.role === "admin") return fail(403, "This action is unauthorized.");

    const tab = String(query.tab ?? "");
    const named = listOf(query.status);
    const errors: Record<string, string> = {};
    if (tab && !(tab in TABS)) errors.tab = "Choose one of the request tabs.";
    if (named.some((status) => !(REQUEST_STATUSES as readonly string[]).includes(status))) errors.status = "Choose request statuses from the list.";
    if (Object.keys(errors).length) return validationFailed(errors);

    const own = ADOPTION_REQUESTS.filter((request) => isOwn(request, account)).sort(
      (a, b) => (b.sent_at ?? "").localeCompare(a.sent_at ?? "") || b.id - a.id,
    );
    const statuses: readonly string[] | null = named.length ? named : tab ? TABS[tab] : null;
    const page = paginate(statuses ? own.filter((request) => statuses.includes(request.status)) : own, query, "/api/v1/adoption-requests");

    // Every status is counted, whatever the tab.
    const status_counts: Partial<Record<RequestStatus, number>> = {};
    for (const request of own) status_counts[request.status] = (status_counts[request.status] ?? 0) + 1;

    return { status: 200, body: { ...page, meta: { ...page.meta, status_counts } } };
  }),

  route("GET", "/adoption-requests/:requestId", ({ params, account }) => {
    const request = ADOPTION_REQUESTS.find((r) => String(r.id) === params.requestId);
    // Someone else's request answers 404, not 403, so ids can't be probed (SEC-AUTHZ-04).
    if (!request || !canView(request, account)) return fail(404, NOT_FOUND);
    return ok(withDetails(request));
  }),

  route("POST", "/home-profiles/:homeProfileId/adoption-requests", (context) => send(context, context.params.homeProfileId)),

  // The same, with the home in the body.
  route("POST", "/adoption-requests", (context) => send(context, ((context.body ?? {}) as NewRequestBody).home_profile_id)),

  // RQ-16: only the pet that sent it withdraws; anyone else is answered like a request that doesn't exist.
  route("POST", "/adoption-requests/:requestId/withdraw", ({ params, body, account }) => {
    const request = ADOPTION_REQUESTS.find((r) => String(r.id) === params.requestId);
    if (!request || account?.role !== "pet" || request.pet.id !== account.profile_id) return fail(404, NOT_FOUND);

    const reason = ((body ?? {}) as { withdraw_reason?: unknown }).withdraw_reason ?? null;
    if (reason !== null && reason !== "" && !WITHDRAW_REASONS.includes(reason)) {
      return validationFailed({ withdraw_reason: "Choose a reason from the list, or leave it out." });
    }
    if (!OPEN_REQUEST_STATUSES.includes(request.status)) {
      return fail(409, "This request has already ended, so there is nothing to withdraw.", { code: "request_already_closed" });
    }

    const wasInProcess = IN_PROCESS_REQUEST_STATUSES.includes(request.status);
    const now = Date.now();
    request.status = "withdrawn";
    request.withdraw_reason = reason === "" ? null : (reason as WithdrawReason | null);
    request.closed_at = new Date(now).toISOString();
    request.expires_at = null;

    // The pet is free again, and its requests On Hold go back to Sent with a fresh 14 days (RQ-15).
    if (wasInProcess) {
      const pet = PETS.find((p) => p.id === request.pet.id);
      if (pet?.status === "in_process") pet.status = "looking_for_a_home";
      for (const other of ADOPTION_REQUESTS.filter((r) => r.pet.id === request.pet.id)) {
        other.pet = { ...other.pet, status: pet?.status ?? other.pet.status };
        if (other.status !== "on_hold") continue;
        other.status = "sent";
        other.expires_at = new Date(now + REQUEST_EXPIRY_DAYS * DAY_MS).toISOString();
      }
    }

    return ok(withDetails(request));
  }),
];
