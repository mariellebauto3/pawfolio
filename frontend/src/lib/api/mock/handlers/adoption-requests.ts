import { ADOPTION_REQUESTS, homeProfileSummary, petSummary } from "@/lib/api/mock/fixtures/adoption-requests";
import { HOME_PROFILES } from "@/lib/api/mock/fixtures/home-profiles";
import { type MockRoute, fail, ok, paginate, route, validationFailed } from "@/lib/api/mock/router";
import type { Account } from "@/types/account";
import type { AdoptionRequest } from "@/types/adoption-request";
import type { RequestStatus } from "@/types/statuses";

// Mirrors the request rules of proposal §5.3 closely enough to show each error state (RQ-05, RQ-06). New requests
// live in memory until the page reloads.

const MAX_OPEN_REQUESTS = 3;
const OPEN_STATUSES: readonly RequestStatus[] = ["sent", "on_hold", "approved", "meet_scheduled", "awaiting_decision"];
const COVER_LETTER_MIN = 50;
const COVER_LETTER_MAX = 600;
const EXPIRY_DAYS = 14;

/** Only the pet, the human on the request and admins may see it (SEC-AUTHZ-03). */
function canView(request: AdoptionRequest, account: Account | null): boolean {
  if (!account) return false;
  if (account.role === "admin") return true;
  if (account.role === "pet") return request.pet.id === account.profile_id;
  return request.home_profile.id === account.profile_id;
}

type NewRequestBody = { home_profile_id?: unknown; cover_letter?: unknown; caretaker_notes?: unknown };

export const adoptionRequestRoutes: MockRoute[] = [
  route("GET", "/adoption-requests", ({ query, account }) => {
    const visible = ADOPTION_REQUESTS.filter((request) => canView(request, account));
    return { status: 200, body: paginate(visible, query, "/api/v1/adoption-requests") };
  }),

  route("GET", "/adoption-requests/:requestId", ({ params, account }) => {
    const request = ADOPTION_REQUESTS.find((r) => String(r.id) === params.requestId);
    // Someone else's request answers 404, not 403, so ids can't be probed (SEC-AUTHZ-04).
    if (!request || !canView(request, account)) return fail(404, "We couldn't find that request.");
    return ok(request);
  }),

  route("POST", "/adoption-requests", ({ body, account }) => {
    if (account?.role !== "pet" || account.profile_id === null) return fail(403, "Only pets can send adoption requests.");
    const petId = account.profile_id;
    const { home_profile_id, cover_letter, caretaker_notes } = (body ?? {}) as NewRequestBody;

    const errors: Record<string, string> = {};
    const home = HOME_PROFILES.find((h) => h.id === Number(home_profile_id));
    if (!home) errors.home_profile_id = "Choose a home to apply to.";
    const letter = typeof cover_letter === "string" ? cover_letter.trim() : "";
    if (letter.length < COVER_LETTER_MIN || letter.length > COVER_LETTER_MAX) {
      errors.cover_letter = `Write between ${COVER_LETTER_MIN} and ${COVER_LETTER_MAX} characters.`;
    }
    if (!home || Object.keys(errors).length) return validationFailed(errors);

    const open = ADOPTION_REQUESTS.filter((r) => r.pet.id === petId && OPEN_STATUSES.includes(r.status));
    if (open.some((r) => r.home_profile.id === home.id)) {
      return fail(409, `You already have an open request with ${home.full_name}.`, { code: "request_already_open" });
    }
    if (open.length >= MAX_OPEN_REQUESTS) {
      return fail(409, `You already have ${MAX_OPEN_REQUESTS} open requests. Wait for an answer or withdraw one first.`, {
        code: "open_request_limit",
      });
    }
    if (!home.is_open_to_adopt) {
      return fail(409, `${home.full_name} isn't open to adopt right now.`, { code: "not_open_to_adopt" });
    }

    const now = new Date();
    const created: AdoptionRequest = {
      id: Math.max(...ADOPTION_REQUESTS.map((r) => r.id)) + 1,
      status: "sent",
      pet: petSummary(petId),
      home_profile: homeProfileSummary(home.id),
      cover_letter: letter,
      caretaker_notes: typeof caretaker_notes === "string" && caretaker_notes.trim() ? caretaker_notes.trim() : null,
      approval_message: null,
      decline_reason: null,
      decision_message: null,
      withdraw_reason: null,
      sent_at: now.toISOString(),
      expires_at: new Date(now.getTime() + EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString(),
      approved_at: null,
      meet_scheduled_at: null,
      awaiting_decision_at: null,
      closed_at: null,
    };
    ADOPTION_REQUESTS.push(created);
    return ok(created, 201);
  }),
];
