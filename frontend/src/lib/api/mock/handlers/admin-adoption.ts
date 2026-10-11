import { ADOPTION_REQUESTS, homeProfileSummary, petSummary } from "@/lib/api/mock/fixtures/adoption-requests";
import { ADOPTIONS } from "@/lib/api/mock/fixtures/adoptions";
import { HOME_PROFILES } from "@/lib/api/mock/fixtures/home-profiles";
import { MEET_AND_GREETS, activeBooking, formatBooking, meetingPassed } from "@/lib/api/mock/fixtures/meet-and-greet";
import { PETS } from "@/lib/api/mock/fixtures/pets";
import { releasePet, setPetStatus, withDetails } from "@/lib/api/mock/handlers/adoption-requests";
import { type MockResult, type MockRoute, fail, ok, paginate, route, validationFailed } from "@/lib/api/mock/router";
import type { AdoptionRequest } from "@/types/adoption-request";
import { RESOLUTION_ACTIONS, type ResolutionAction } from "@/types/adoption-resolution";
import { REQUEST_STATUSES, type RequestStatus } from "@/types/statuses";

// The admin's side of adoption in mock mode (docs/api/adoption-and-meet-greet.md, "The admin's monitor" and
// "Resolve adoption issue"; RQ-18, RQ-19, MG-15, MG-16, AL-07, AL-08), with the API's answers and its rules: which
// of the four resolutions applies to what, who a reminder goes to, and that a reason is required. What is changed
// lives in memory, so a reload brings the fixtures back, and a page rendered on the server doesn't see what the
// browser changed. All of it is made up (SEC-PRIV-06).

const DAY_MS = 24 * 60 * 60 * 1000;
const OVERDUE_AFTER_DAYS = 7;
const EXPIRY_DAYS = 14;
const STARTED_AT = Date.now();
const daysAgo = (days: number) => new Date(STARTED_AT - days * DAY_MS).toISOString();

// A request that only the monitor lists, so the Overdue tab has something to follow up without changing what the
// member personas see: Tofu met Paolo Garcia nine days ago and no decision was recorded.
const OVERDUE_REQUEST: AdoptionRequest = {
  id: 90,
  status: "awaiting_decision",
  pet: { ...petSummary(6), status: "in_process" },
  home_profile: homeProfileSummary(3),
  cover_letter: "I'm a calm lap cat who likes quiet afternoons. A first-time Furparent who is ready to learn sounds like my kind of person.",
  caretaker_notes: null,
  approval_message: "We'd love to meet.",
  decline_reason: null,
  decision_message: null,
  withdraw_reason: null,
  sent_at: daysAgo(20),
  expires_at: null,
  approved_at: daysAgo(17),
  meet_scheduled_at: daysAgo(14),
  awaiting_decision_at: daysAgo(9),
  overdue_flagged_at: daysAgo(2),
  closed_at: null,
};
const OVERDUE_MEETING = {
  id: 90,
  adoption_request_id: 90,
  meet_greet_slot_id: 90,
  status: "ended",
  booked_at: daysAgo(15),
  confirmed_at: daysAgo(14),
  ended_at: daysAgo(9),
  ended_by: null,
  end_reason: null,
  end_details: null,
  proposed_slot_id: null,
  slot: { id: 90, home_profile_id: 3, starts_at: daysAgo(9), place_type: "public_spot", place_details: "Ayala Triangle Gardens" },
  proposed_slot: null,
};

const everyRequest = () => [...ADOPTION_REQUESTS, OVERDUE_REQUEST];
const find = (requestId: string | number) => everyRequest().find((request) => String(request.id) === String(requestId));

/** The accounts behind the mock pets and homes, where a persona exists for one. */
const PET_ACCOUNTS: Record<number, { id: number; email: string }> = { 1: { id: 1, email: "mochi@example.com" }, 4: { id: 9, email: "luna@example.com" } };
const HOME_ACCOUNTS: Record<number, { id: number; email: string }> = { 1: { id: 2, email: "ana.santos@example.com" } };

type ResolutionRow = { id: number; action: ResolutionAction; reason: string; pet_id: number; adoption_request_id: number | null; admin_name: string; created_at: string };
const RESOLUTIONS: ResolutionRow[] = [];
const REMINDERS = new Map<number, number>();

const isOverdue = (request: AdoptionRequest) =>
  request.status === "awaiting_decision" &&
  (request.overdue_flagged_at !== null || (request.awaiting_decision_at !== null && new Date(request.awaiting_decision_at).getTime() <= Date.now() - OVERDUE_AFTER_DAYS * DAY_MS));

const latestMeeting = (request: AdoptionRequest) => {
  if (request.id === OVERDUE_REQUEST.id) return OVERDUE_MEETING;
  const booking = MEET_AND_GREETS.findLast((candidate) => candidate.adoption_request_id === request.id);
  return booking ? formatBooking(booking) : null;
};

const updatedAt = (request: AdoptionRequest) => request.closed_at ?? request.awaiting_decision_at ?? request.meet_scheduled_at ?? request.approved_at ?? request.sent_at;

const listRow = (request: AdoptionRequest) => ({ ...request, updated_at: updatedAt(request), is_overdue: isOverdue(request), latest_meet_and_greet: latestMeeting(request) });

/** Who has the next step on a request, as the API says it; null when nobody does. */
function waitingOn(request: AdoptionRequest): "pet" | "human" | null {
  if (request.status === "sent" || request.status === "awaiting_decision") return "human";
  if (request.status === "approved") return activeBooking(request.id) ? "human" : "pet";
  return request.status === "meet_scheduled" && meetingPassed(request) ? "human" : null;
}

const remindedRecently = (request: AdoptionRequest) => (REMINDERS.get(request.id) ?? 0) > Date.now() - DAY_MS;

function formatResolution(row: ResolutionRow) {
  const pet = PETS.find((candidate) => candidate.id === row.pet_id);
  const request = row.adoption_request_id === null ? undefined : find(row.adoption_request_id);
  return {
    id: row.id,
    action: row.action,
    reason: row.reason,
    pet: pet ? { id: pet.id, name: pet.name } : null,
    adoption_request_id: row.adoption_request_id,
    home_name: request?.home_profile.full_name ?? null,
    admin_name: row.admin_name,
    created_at: row.created_at,
  };
}

function detail(request: AdoptionRequest) {
  // The monitor carries no phone number or address, and no slots to book (SEC-PRIV-02).
  const details: Record<string, unknown> =
    request.id === OVERDUE_REQUEST.id
      ? { ...request, match_score: null, cooldown_until: null, adoption: null, meet_and_greet: OVERDUE_MEETING, active_meet_and_greet: null, meeting_passed: true }
      : { ...withDetails(request) };
  for (const key of ["contacts", "unlocked_contact", "contact_unlocked", "available_slots"]) delete details[key];
  const side = waitingOn(request);
  const last = REMINDERS.get(request.id);
  const petAccount = PET_ACCOUNTS[request.pet.id];
  const homeAccount = HOME_ACCOUNTS[request.home_profile.id];

  return {
    ...details,
    ...listRow(request),
    parties: {
      pet_user_id: petAccount?.id ?? null,
      pet_email: petAccount?.email ?? null,
      pet_account_status: "active",
      human_user_id: homeAccount?.id ?? null,
      human_email: homeAccount?.email ?? null,
      human_account_status: "active",
    },
    reminder: { waiting_on: side, last_sent_at: last ? new Date(last).toISOString() : null, can_send: side !== null && !remindedRecently(request) },
    resolutions: RESOLUTIONS.filter((row) => row.adoption_request_id === request.id).map(formatResolution),
  };
}

// ---- Resolve adoption issue: the same four rules as the API's ResolveAdoptionIssue.

type Rule = { available: boolean; request_ids: number[]; why_not: string };

function rules(petId: number): Record<ResolutionAction, Rule> {
  const pet = PETS.find((candidate) => candidate.id === petId);
  const name = pet?.name ?? "This pet";
  const requests = everyRequest().filter((request) => request.pet.id === petId);
  const link = ADOPTIONS.find((adoption) => adoption.pet_id === petId);
  const adopted = pet?.status === "adopted_hired" || link !== undefined;
  const ids = (statuses: RequestStatus[]) => requests.filter((request) => statuses.includes(request.status)).map((request) => request.id);
  const inProcess = adopted ? [] : ids(["approved", "meet_scheduled", "awaiting_decision"]);
  const closable = ids(["sent", "on_hold"]);
  const reopenable = adopted ? [] : ids(["meet_scheduled", "awaiting_decision"]);
  const petInProcess = pet?.status === "in_process" || requests.some((request) => request.pet.status === "in_process");

  return {
    cancel_adoption: { available: adopted, request_ids: link ? [link.adoption_request_id] : [], why_not: `${name} hasn't been adopted, so there is no adoption to cancel.` },
    return_to_looking_for_a_home: {
      available: !adopted && (petInProcess || inProcess.length > 0),
      request_ids: inProcess,
      why_not: adopted ? `${name} is adopted. Cancel the adoption to return it to Looking for a Home.` : `${name} isn't In Process, so there is no process to end.`,
    },
    close_request: { available: closable.length > 0, request_ids: closable, why_not: `${name} has no request that is Sent or On Hold. A request in process is ended by returning the pet to Looking for a Home.` },
    reopen_meet_greet_booking: { available: reopenable.length > 0, request_ids: reopenable, why_not: `No request of ${name} is Meet Scheduled or Awaiting Decision, so there is no booking to reopen.` },
  };
}

const field = (body: unknown, name: string): unknown => (typeof body === "object" && body !== null ? (body as Record<string, unknown>)[name] : undefined);

type Plan = { action: ResolutionAction; petId: number; target: AdoptionRequest | null; change: Record<string, unknown> };

/** The action checked against the rules: a plan, or the API's refusal. */
function plan(petId: string, body: unknown): Plan | MockResult {
  const pet = PETS.find((candidate) => String(candidate.id) === petId);
  if (!pet) return fail(404, "Not found.");
  const action = field(body, "action");
  if (!(RESOLUTION_ACTIONS as readonly unknown[]).includes(action)) return validationFailed({ action: "Choose what to change." });
  const rule = rules(pet.id)[action as ResolutionAction];
  if (!rule.available) return fail(409, rule.why_not, { code: "resolution_not_available" });

  const wanted = field(body, "adoption_request_id");
  let target: AdoptionRequest | null = null;
  if (rule.request_ids.length > 0) {
    if ((wanted === undefined || wanted === null) && rule.request_ids.length > 1) return fail(409, "Choose the request this change is for.", { code: "resolution_request_required" });
    const id = typeof wanted === "number" ? wanted : rule.request_ids[0];
    if (!rule.request_ids.includes(id)) return fail(409, `That change no longer applies to this request. Reload the page to see where ${pet.name} stands.`, { code: "resolution_not_available" });
    target = find(id) ?? null;
  }

  const link = ADOPTIONS.find((adoption) => adoption.pet_id === pet.id);
  const furparent = link ? (HOME_PROFILES.find((home) => home.id === link.home_profile_id)?.full_name ?? null) : null;
  const before = target?.pet.status ?? pet.status;
  const kind = action as ResolutionAction;

  return {
    action: kind,
    petId: pet.id,
    target,
    change: {
      pet_id: pet.id,
      pet_name: pet.name,
      action: kind,
      request: target ? { id: target.id, home_name: target.home_profile.full_name } : null,
      before: { pet_status: before, request_status: target?.status ?? null, furparent_name: furparent },
      after: {
        pet_status: kind === "close_request" ? before : kind === "reopen_meet_greet_booking" ? "in_process" : "looking_for_a_home",
        request_status: target ? (kind === "reopen_meet_greet_booking" ? "approved" : "closed") : null,
        furparent_name: kind === "cancel_adoption" ? null : furparent,
      },
      requests_restored: kind === "return_to_looking_for_a_home" ? everyRequest().filter((request) => request.pet.id === pet.id && request.status === "on_hold").length : 0,
      meeting_ended: target !== null && activeBooking(target.id) !== null,
    },
  };
}

function apply({ action, petId, target }: Plan, now: string) {
  if (target) {
    const booking = activeBooking(target.id);
    if (booking) Object.assign(booking, { status: "ended", ended_at: now, end_reason: "other" });
    if (action === "reopen_meet_greet_booking") {
      Object.assign(target, { status: "approved", meet_scheduled_at: null, awaiting_decision_at: null, closed_at: null, expires_at: new Date(Date.now() + EXPIRY_DAYS * DAY_MS).toISOString() });
    } else {
      Object.assign(target, { status: "closed", closed_at: now, expires_at: null });
    }
    target.overdue_flagged_at = null;
  }

  if (action === "cancel_adoption") {
    const index = ADOPTIONS.findIndex((adoption) => adoption.pet_id === petId);
    if (index >= 0) {
      const [removed] = ADOPTIONS.splice(index, 1);
      const home = HOME_PROFILES.find((candidate) => candidate.id === removed.home_profile_id);
      // The human keeps the Furparent label (§5.5); only the link to this pet goes.
      if (home) home.adopted_pets = home.adopted_pets.filter((adopted) => adopted.adoption_id !== removed.id);
    }
    const pet = PETS.find((candidate) => candidate.id === petId);
    if (pet) pet.hired_by = null;
    setPetStatus(petId, "looking_for_a_home");
  } else if (action === "return_to_looking_for_a_home") {
    releasePet(petId, Date.now());
  } else if (action === "reopen_meet_greet_booking") {
    setPetStatus(petId, "in_process");
  }
  // The monitor's own request carries the pet's status itself.
  if (OVERDUE_REQUEST.pet.id === petId && action !== "close_request") {
    OVERDUE_REQUEST.pet = { ...OVERDUE_REQUEST.pet, status: action === "reopen_meet_greet_booking" ? "in_process" : "looking_for_a_home" };
  }
}

export const adminAdoptionRoutes: MockRoute[] = [
  route(
    "GET",
    "/admin/adoption-requests",
    ({ query }) => {
      const tab = query.tab ?? "all";
      if (!["all", "meet_and_greets", "overdue"].includes(String(tab))) return validationFailed({ tab: "The selected tab is invalid." });
      if (query.status && !(REQUEST_STATUSES as readonly unknown[]).includes(query.status)) return validationFailed({ status: "The selected status is invalid." });
      const search = (typeof query.q === "string" ? query.q : "").trim().toLowerCase();

      const rows = everyRequest()
        .filter((request) => tab === "all" || (tab === "overdue" ? isOverdue(request) : latestMeeting(request) !== null))
        .filter((request) => !query.status || request.status === query.status)
        .filter((request) => !search || request.pet.name.toLowerCase().includes(search) || request.home_profile.full_name.toLowerCase().includes(search))
        .sort((a, b) => Date.parse(b.sent_at ?? "") - Date.parse(a.sent_at ?? "") || b.id - a.id)
        .map(listRow);
      return { status: 200, body: paginate(rows, query, "/api/v1/admin/adoption-requests") };
    },
    "admin",
  ),

  route(
    "GET",
    "/admin/adoption-requests/:requestId",
    ({ params }) => {
      const request = find(params.requestId);
      return request ? ok(detail(request)) : fail(404, "Not found.");
    },
    "admin",
  ),

  // RQ-19: one reminder a day, to the side that has the next step.
  route(
    "POST",
    "/admin/adoption-requests/:requestId/remind",
    ({ params }) => {
      const request = find(params.requestId);
      if (!request) return fail(404, "Not found.");
      const side = waitingOn(request);
      if (side === null) return fail(409, "Nobody has a step to take on this request right now, so there's no one to remind.", { code: "no_reminder_needed" });
      if (remindedRecently(request)) return fail(409, "A reminder for this request already went out in the last 24 hours.", { code: "already_reminded" });
      REMINDERS.set(request.id, Date.now());
      return ok({ reminded: true, recipient: side, recipient_name: side === "pet" ? request.pet.name : request.home_profile.full_name });
    },
    "admin",
  ),

  // AL-07: the pet, its Furparent link, its requests, and what each of the four actions offers now.
  route(
    "GET",
    "/admin/adoptions/:petId/resolve",
    ({ params }) => {
      const pet = PETS.find((candidate) => String(candidate.id) === params.petId);
      if (!pet) return fail(404, "Not found.");
      const link = ADOPTIONS.find((adoption) => adoption.pet_id === pet.id);
      const requests = everyRequest().filter((request) => request.pet.id === pet.id).sort((a, b) => b.id - a.id);
      const status = requests.find((request) => request.id === OVERDUE_REQUEST.id)?.pet.status ?? pet.status;
      const petRules = rules(pet.id);

      return ok({
        pet: { ...petSummary(pet.id), status, user_id: PET_ACCOUNTS[pet.id]?.id ?? null },
        furparent: link
          ? { home_profile_id: link.home_profile_id, full_name: HOME_PROFILES.find((home) => home.id === link.home_profile_id)?.full_name ?? null, adopted_at: link.adopted_at, adoption_request_id: link.adoption_request_id }
          : null,
        requests: requests.map((request) => ({ id: request.id, status: request.status, home_name: request.home_profile.full_name, sent_at: request.sent_at, closed_at: request.closed_at })),
        actions: RESOLUTION_ACTIONS.map((action) => ({
          action,
          available: petRules[action].available,
          request_ids: petRules[action].request_ids,
          unavailable_reason: petRules[action].available ? null : petRules[action].why_not,
        })),
      });
    },
    "admin",
  ),

  // AL-08: what the action would change, before anything is written.
  route(
    "POST",
    "/admin/adoptions/:petId/resolve/preview",
    ({ params, body }) => {
      const planned = plan(params.petId, body);
      return "status" in planned ? planned : ok(planned.change);
    },
    "admin",
  ),

  route(
    "POST",
    "/admin/adoptions/:petId/resolve",
    ({ params, body, account }) => {
      const reason = field(body, "reason");
      const planned = plan(params.petId, body);
      if ("status" in planned && planned.status === 422) return planned;
      if (typeof reason !== "string" || reason.trim() === "") return validationFailed({ reason: "Enter a reason for this change." });
      if (reason.trim().length > 1000) return validationFailed({ reason: "Keep the reason to 1000 characters or fewer." });
      if ("status" in planned) return planned;

      const now = new Date().toISOString();
      apply(planned, now);
      const row: ResolutionRow = {
        id: RESOLUTIONS.length + 1,
        action: planned.action,
        reason: reason.trim(),
        pet_id: planned.petId,
        adoption_request_id: planned.target?.id ?? null,
        admin_name: account?.display_name ?? "admin.jess",
        created_at: now,
      };
      RESOLUTIONS.push(row);
      return ok({ ...formatResolution(row), pet_status: planned.change.after && (planned.change.after as { pet_status: string }).pet_status, change: planned.change });
    },
    "admin",
  ),

  route(
    "GET",
    "/admin/adoption-resolutions",
    ({ query }) => {
      const rows = [...RESOLUTIONS].reverse().map(formatResolution);
      return { status: 200, body: paginate(rows, query, "/api/v1/admin/adoption-resolutions") };
    },
    "admin",
  ),
];
