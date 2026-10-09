import { OPEN_REQUEST_STATUSES } from "@/constants/adoption-requests";
import { ADOPTION_REQUESTS, homeProfileSummary } from "@/lib/api/mock/fixtures/adoption-requests";
import { ADOPTIONS } from "@/lib/api/mock/fixtures/adoptions";
import { HOME_PROFILES } from "@/lib/api/mock/fixtures/home-profiles";
import { MEET_AND_GREETS, MEET_GREET_SLOTS, activeBooking, meetingPassed } from "@/lib/api/mock/fixtures/meet-and-greet";
import { PETS } from "@/lib/api/mock/fixtures/pets";
import { readMessage, receivedBy, releasePet, setPetStatus, withDetails } from "@/lib/api/mock/handlers/adoption-requests";
import { type MockResult, type MockRoute, fail, ok, route, validationFailed } from "@/lib/api/mock/router";
import type { AdoptionRequest, DeclineReason } from "@/types/adoption-request";

// The decision after a Meet & Greet and the adoption record in mock mode (docs/api/adoption-and-meet-greet.md),
// answered as the API answers them: the human adopts or declines once the meeting time has passed, and the two
// sides read the record afterwards. What is decided lives in memory, so it is back to the fixtures after a reload,
// and a page rendered on the server doesn't see what the browser changed.

const DAY_MS = 24 * 60 * 60 * 1000;
const DECLINE_REASONS: readonly unknown[] = ["not_right_fit", "not_adopting_now", "another_pet_joining", "other"] satisfies DeclineReason[];
const NOT_FOUND = "We couldn't find that request.";

/** Why the human can't decide on this request now, or null when they can: only once the meeting time has passed. */
function decisionProblem(request: AdoptionRequest): MockResult | null {
  if (meetingPassed(request)) return null;
  return request.status === "meet_scheduled"
    ? fail(409, "You can decide once the Meet & Greet time has passed.", { code: "meeting_not_yet_passed" })
    : fail(409, "This request isn't waiting for a decision.", { code: "invalid_request_state" });
}

/** The meeting took place and the decision closes it. Nobody called it off, so nobody is named as ending it. */
function endMeeting(request: AdoptionRequest, now: string) {
  const booking = activeBooking(request.id);
  if (booking) Object.assign(booking, { status: "ended", ended_at: now });
}

export const adoptionRoutes: MockRoute[] = [
  // AL-01: the pet is Hired and linked to its one Furparent, and its other open requests close.
  route("POST", "/adoption-requests/:requestId/adopt", ({ params, body, account }) => {
    const request = receivedBy(params.requestId, account);
    if (!request) return fail(404, NOT_FOUND);

    const read = readMessage(((body ?? {}) as { decision_message?: unknown }).decision_message);
    if ("error" in read) return validationFailed({ decision_message: read.error });

    const problem = decisionProblem(request);
    if (problem) return problem;
    const pet = PETS.find((p) => p.id === request.pet.id);
    const home = HOME_PROFILES.find((h) => h.id === request.home_profile.id);
    if (!pet || !home) return fail(404, NOT_FOUND);
    if (pet.status === "adopted_hired" || ADOPTIONS.some((a) => a.pet_id === pet.id)) {
      return fail(409, `${pet.name} has already been adopted.`, { code: "already_adopted" });
    }

    const now = new Date().toISOString();
    endMeeting(request, now);
    request.status = "adopted";
    request.decision_message = read.message;
    request.closed_at = now;
    request.expires_at = null;
    request.overdue_flagged_at = null;

    const adoption = { id: Math.max(0, ...ADOPTIONS.map((a) => a.id)) + 1, pet_id: pet.id, home_profile_id: home.id, adoption_request_id: request.id, adopted_at: now };
    ADOPTIONS.push(adoption);

    // A Furparent for good, with Open to Adopt off until the human turns it on again.
    home.is_furparent = true;
    home.is_open_to_adopt = false;
    pet.hired_by = { adoption_id: adoption.id, home_profile_id: home.id, full_name: home.full_name, city: home.city, adopted_at: now, is_home_viewable: true };
    setPetStatus(pet.id, "adopted_hired");
    home.adopted_pets = [{ adoption_id: adoption.id, adopted_at: now, pet: { ...request.pet } }, ...home.adopted_pets];

    for (const other of ADOPTION_REQUESTS) {
      if (other.home_profile.id === home.id) other.home_profile = homeProfileSummary(home.id);
      if (other.pet.id !== pet.id || other.id === request.id || !OPEN_REQUEST_STATUSES.includes(other.status)) continue;
      other.status = "closed";
      other.closed_at = now;
      other.expires_at = null;
    }

    return ok(withDetails(request));
  }),

  // MG-14: ends the request as Not Adopted, frees the pet, and starts the 30-day cooldown.
  route("POST", "/adoption-requests/:requestId/decline-after-meeting", ({ params, body, account }) => {
    const request = receivedBy(params.requestId, account);
    if (!request) return fail(404, NOT_FOUND);

    const sent = (body ?? {}) as { decline_reason?: unknown; decision_message?: unknown };
    const reason = sent.decline_reason ?? null;
    const read = readMessage(sent.decision_message);
    const errors: Record<string, string> = {};
    if (reason !== null && reason !== "" && !DECLINE_REASONS.includes(reason)) errors.decline_reason = "Choose a reason from the list, or leave it out.";
    if ("error" in read) errors.decision_message = read.error;
    if ("error" in read || Object.keys(errors).length) return validationFailed(errors);

    const problem = decisionProblem(request);
    if (problem) return problem;

    const now = Date.now();
    endMeeting(request, new Date(now).toISOString());
    request.status = "not_adopted";
    request.decline_reason = reason === "" ? null : (reason as DeclineReason | null);
    request.decision_message = read.message;
    request.closed_at = new Date(now).toISOString();
    request.expires_at = null;
    request.overdue_flagged_at = null;
    releasePet(request.pet.id, now);

    return ok(withDetails(request));
  }),

  // AL-06: the record of one adoption, for the pet, its Furparent and admins; 404 for anyone else (SEC-AUTHZ-04).
  route("GET", "/adoptions/:adoptionId", ({ params, account }) => {
    const adoption = ADOPTIONS.find((a) => String(a.id) === params.adoptionId);
    const request = adoption && ADOPTION_REQUESTS.find((r) => r.id === adoption.adoption_request_id);
    const reads =
      account?.role === "admin" ||
      (account?.role === "pet" && account.profile_id === adoption?.pet_id) ||
      (account?.role === "human" && account.profile_id === adoption?.home_profile_id);
    if (!adoption || !request || !reads) return fail(404, "We couldn't find that adoption.");

    const { id, full_name, city, profile_photo_url, is_furparent } = request.home_profile;
    const pet = { id: request.pet.id, name: request.pet.name, species: request.pet.species, breed: request.pet.breed, city: request.pet.city, status: request.pet.status, photo_url: request.pet.photo_url };
    const met = MEET_AND_GREETS.findLast((booking) => booking.adoption_request_id === request.id);
    const slot = MEET_GREET_SLOTS.find((s) => s.id === met?.slot_id);
    const days = request.sent_at ? Math.max(1, Math.floor((new Date(adoption.adopted_at).getTime() - new Date(request.sent_at).getTime()) / DAY_MS)) : null;

    return ok({
      id: adoption.id,
      pet,
      home_profile: { id, full_name, city, profile_photo_url, is_furparent },
      adoption_request_id: request.id,
      adopted_at: adoption.adopted_at,
      link_removed_at: null,
      days_to_adoption: days,
      cover_letter: request.cover_letter,
      timeline: {
        sent_at: request.sent_at,
        approved_at: request.approved_at,
        meet_scheduled_at: request.meet_scheduled_at,
        meet_starts_at: slot?.starts_at ?? null,
        adopted_at: adoption.adopted_at,
      },
      meeting: slot ? { id: slot.id, home_profile_id: slot.home_profile_id, starts_at: slot.starts_at, place_type: slot.place_type, place_details: slot.place_details } : null,
    });
  }),
];
