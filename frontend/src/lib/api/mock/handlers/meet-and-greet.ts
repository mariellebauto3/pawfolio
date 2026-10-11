import { REQUEST_EXPIRY_DAYS } from "@/constants/adoption-requests";
import { ADOPTION_REQUESTS } from "@/lib/api/mock/fixtures/adoption-requests";
import { MEET_AND_GREETS, MEET_GREET_SLOTS, type MockBooking, type MockSlot, activeBooking, isBookable, meetingPassed } from "@/lib/api/mock/fixtures/meet-and-greet";
import { withDetails } from "@/lib/api/mock/handlers/adoption-requests";
import { type MockResult, type MockRoute, fail, ok, paginate, route, validationFailed } from "@/lib/api/mock/router";
import type { Account } from "@/types/account";
import type { AdoptionRequest } from "@/types/adoption-request";
import type { CancelReason, DidntHappenReason, MeetEndReason, MeetGreetSlot, PlaceType } from "@/types/meet-and-greet";

// Meet & Greet in mock mode (docs/api/adoption-and-meet-greet.md), answered as the API answers it: a human keeps
// slots, a pet books one on an Approved request, the human confirms or proposes another time, either side
// reschedules or cancels, and the human reports a meeting that didn't happen. What is booked lives in memory, so it is back to the fixtures after a reload, and a page
// rendered on the server doesn't see what the browser changed.

const DAY_MS = 24 * 60 * 60 * 1000;
const YEAR_MS = 365 * DAY_MS;
const PLACE_DETAILS_MAX = 255;
const NOTE_MAX = 600;
const MAX_WEEKS = 4;
const PLACE_TYPES: readonly unknown[] = ["public_spot", "shelter", "caretaker_location"] satisfies PlaceType[];
const CANCEL_REASONS: readonly unknown[] = ["schedule_conflict", "pet_unwell", "weather_or_travel", "other"] satisfies CancelReason[];
const DIDNT_HAPPEN_REASONS: readonly unknown[] = ["didnt_show_pet_side", "didnt_show_human_side", "moved_to_another_day", "other"] satisfies DidntHappenReason[];
const NOT_FOUND = "We couldn't find that request.";
const HUMANS_ONLY = "Only a human account keeps Meet & Greet slots.";

type Side = "pet" | "human";

/** The request, when the account is the side that may do this; anyone else is answered 404 (SEC-AUTHZ-04). */
function requestFor(requestId: string, account: Account | null, sides: readonly Side[]): { request: AdoptionRequest; side: Side } | null {
  const request = ADOPTION_REQUESTS.find((r) => String(r.id) === requestId);
  if (!request || !account) return null;
  const side = account.role === "pet" && request.pet.id === account.profile_id ? "pet" : account.role === "human" && request.home_profile.id === account.profile_id ? "human" : null;
  return side && sides.includes(side) ? { request, side } : null;
}

const conflict = (message: string, code: string) => fail(409, message, { code });

/** A slot as the API sends it: `deleted` is the mock's own bookkeeping. */
const shown = ({ id, home_profile_id, starts_at, place_type, place_details }: MockSlot): MeetGreetSlot => ({ id, home_profile_id, starts_at, place_type, place_details });

/** Why the slot can't be taken for this request, or the slot when it can: the home's own, still ahead, held by nobody. */
function openSlot(request: AdoptionRequest, slotId: unknown): MockSlot | MockResult {
  const slot = MEET_GREET_SLOTS.find((s) => s.id === Number(slotId) && s.home_profile_id === request.home_profile.id && !s.deleted);
  if (!slot || new Date(slot.starts_at).getTime() <= Date.now()) return conflict("That slot isn't available any more. Choose another one.", "slot_unavailable");
  const held = MEET_AND_GREETS.find((booking) => booking.slot_id === slot.id && booking.status !== "ended");
  if (held?.adoption_request_id === request.id) return conflict("That is the time already booked. Choose another one.", "slot_unchanged");
  if (held) return conflict("That slot was just booked. Choose another one.", "slot_already_booked");
  return slot;
}

const isSlot = (value: MockSlot | MockResult): value is MockSlot => "starts_at" in value;

function book(request: AdoptionRequest, slot: MockSlot): MockBooking {
  const booking: MockBooking = {
    id: Math.max(0, ...MEET_AND_GREETS.map((b) => b.id)) + 1,
    adoption_request_id: request.id,
    slot_id: slot.id,
    status: "booked",
    booked_at: new Date().toISOString(),
    confirmed_at: null,
    ended_at: null,
    ended_by: null,
    end_reason: null,
    end_details: null,
    proposed_slot_id: null,
  };
  MEET_AND_GREETS.push(booking);
  return booking;
}

function end(booking: MockBooking, by: Side, reason: MeetEndReason, details: string | null = null, movedTo: MockSlot | null = null) {
  Object.assign(booking, { status: "ended", ended_at: new Date().toISOString(), ended_by: by, end_reason: reason, end_details: details, proposed_slot_id: movedTo?.id ?? null });
}

/** Booking is open again: Approved, with a fresh 14 days to book. */
function reopenBooking(request: AdoptionRequest) {
  request.status = "approved";
  request.meet_scheduled_at = null;
  request.awaiting_decision_at = null;
  request.overdue_flagged_at = null;
  request.expires_at = new Date(Date.now() + REQUEST_EXPIRY_DAYS * DAY_MS).toISOString();
}

/** An optional note: trimmed, null when empty, or an error when it is too long. */
function readNote(value: unknown, what: string): { note: string | null } | { error: string } {
  const note = typeof value === "string" ? value.trim() : "";
  if ((value !== undefined && value !== null && typeof value !== "string") || note.length > NOTE_MAX) return { error: `Keep the ${what} to ${NOTE_MAX} characters or fewer.` };
  return { note: note === "" ? null : note };
}

const slotIdOf = (body: unknown, ...names: string[]) => names.map((name) => ((body ?? {}) as Record<string, unknown>)[name]).find((value) => value !== undefined && value !== null);
const isId = (value: unknown) => Number.isInteger(Number(value)) && Number(value) >= 1;

export const meetAndGreetRoutes: MockRoute[] = [
  // MG-01: a human's slots still ahead with who booked them, or the Meet & Greets already behind.
  route("GET", "/meet-greet-slots", ({ query, account }) => {
    const when = String(query.when ?? "");
    if (when && when !== "upcoming" && when !== "past") return validationFailed({ when: "Choose upcoming or past." });
    const now = Date.now();

    if (account?.role === "human") {
      const own = MEET_GREET_SLOTS.filter((slot) => slot.home_profile_id === account.profile_id);
      if (when === "past") {
        const met = MEET_AND_GREETS.flatMap((booking) => {
          const slot = own.find((s) => s.id === booking.slot_id);
          const request = ADOPTION_REQUESTS.find((r) => r.id === booking.adoption_request_id);
          if (!slot || !request || !booking.confirmed_at || new Date(slot.starts_at).getTime() > now) return [];
          // Called off before its time: it never took place.
          if (booking.ended_at && booking.ended_at < slot.starts_at) return [];
          return [{ id: booking.id, adoption_request_id: request.id, pet_name: request.pet.name, request_status: request.status, end_reason: booking.end_reason, slot: shown(slot) }];
        }).sort((a, b) => b.slot.starts_at.localeCompare(a.slot.starts_at));
        return { status: 200, body: paginate(met, query, "/api/v1/meet-greet-slots") };
      }

      const upcoming = own
        .filter((slot) => !slot.deleted && new Date(slot.starts_at).getTime() > now)
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at) || a.id - b.id)
        .map((slot) => {
          const booking = MEET_AND_GREETS.find((b) => b.slot_id === slot.id && b.status !== "ended");
          const request = booking && ADOPTION_REQUESTS.find((r) => r.id === booking.adoption_request_id);
          return {
            ...shown(slot),
            is_booked: Boolean(booking),
            active_booking: booking && request ? { id: booking.id, status: booking.status, adoption_request_id: request.id, pet_name: request.pet.name } : null,
          };
        });
      return { status: 200, body: paginate(upcoming, query, "/api/v1/meet-greet-slots") };
    }

    // A pet reads the open slots of a home that approved it.
    if (account?.role === "pet" && query.home_profile_id) {
      const homeId = Number(query.home_profile_id);
      const approved = ADOPTION_REQUESTS.some(
        (r) => r.pet.id === account.profile_id && r.home_profile.id === homeId && (r.status === "approved" || r.status === "meet_scheduled"),
      );
      if (!approved) return fail(403, "You can only view slots for a home that approved your request.");
      const open = MEET_GREET_SLOTS.filter((slot) => slot.home_profile_id === homeId && isBookable(slot, now))
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
        .map(shown);
      return ok(open);
    }

    return fail(403, HUMANS_ONLY);
  }),

  // MG-02: one slot, or the same slot on each of up to 4 weeks in a row. Always answered as a list.
  route("POST", "/meet-greet-slots", ({ body, account }) => {
    if (account?.role !== "human" || account.profile_id === null) return fail(403, HUMANS_ONLY);
    const sent = (body ?? {}) as { starts_at?: unknown; place_type?: unknown; place_details?: unknown; repeat_weeks?: unknown };

    const errors: Record<string, string> = {};
    const first = typeof sent.starts_at === "string" ? new Date(sent.starts_at).getTime() : Number.NaN;
    const now = Date.now();
    if (Number.isNaN(first)) errors.starts_at = "Choose a date and a time.";
    else if (first <= now) errors.starts_at = "Choose a time that is still ahead.";
    else if (first >= now + YEAR_MS) errors.starts_at = "Choose a date within the next 12 months.";
    if (!PLACE_TYPES.includes(sent.place_type)) errors.place_type = "Choose where the meeting takes place.";
    const details = typeof sent.place_details === "string" ? sent.place_details.trim() : "";
    if (details === "" && sent.place_type !== "caretaker_location") errors.place_details = "Say where to meet, such as the name of the park or the shelter.";
    else if (details.length > PLACE_DETAILS_MAX) errors.place_details = `Keep the place details to ${PLACE_DETAILS_MAX} characters or fewer.`;
    const weeks = sent.repeat_weeks === undefined || sent.repeat_weeks === null ? 1 : Number(sent.repeat_weeks);
    if (!Number.isInteger(weeks) || weeks < 1 || weeks > MAX_WEEKS) errors.repeat_weeks = `A slot repeats for ${MAX_WEEKS} weeks at most.`;
    if (Object.keys(errors).length) return validationFailed(errors);

    const times = Array.from({ length: weeks }, (_, week) => new Date(first + week * 7 * DAY_MS).toISOString());
    const own = MEET_GREET_SLOTS.filter((slot) => slot.home_profile_id === account.profile_id && !slot.deleted);
    if (own.some((slot) => times.some((time) => new Date(slot.starts_at).getTime() === new Date(time).getTime()))) {
      return validationFailed({ starts_at: weeks > 1 ? "You already have a slot at that time in one of these weeks." : "You already have a slot at that time." });
    }

    const added = times.map((starts_at) => {
      const slot: MockSlot = {
        id: Math.max(0, ...MEET_GREET_SLOTS.map((s) => s.id)) + 1,
        home_profile_id: account.profile_id as number,
        starts_at,
        place_type: sent.place_type as PlaceType,
        place_details: details === "" ? null : details,
        deleted: false,
      };
      MEET_GREET_SLOTS.push(slot);
      return shown(slot);
    });
    return ok(added, 201);
  }),

  // MG-01: an open slot is removed; one a pet has booked stays.
  route("DELETE", "/meet-greet-slots/:slotId", ({ params, account }) => {
    const slot = MEET_GREET_SLOTS.find((s) => String(s.id) === params.slotId && account?.role === "human" && s.home_profile_id === account.profile_id && !s.deleted);
    if (!slot) return fail(404, "We couldn't find that slot.");
    if (MEET_AND_GREETS.some((booking) => booking.slot_id === slot.id && booking.status !== "ended")) {
      return conflict("A pet has booked this slot. Propose another time or cancel the meeting on the request first.", "slot_has_active_booking");
    }
    slot.deleted = true;
    return ok({ deleted: true });
  }),

  // MG-03: the pet books a slot. Booking again before the human confirms changes it (MG-04).
  route("POST", "/adoption-requests/:requestId/meet-and-greet", ({ params, body, account }) => {
    const slotId = slotIdOf(body, "slot_id", "meet_greet_slot_id");
    if (!isId(slotId)) return validationFailed({ slot_id: "Choose one of the open slots." });
    const found = requestFor(params.requestId, account, ["pet"]);
    if (!found) return fail(404, NOT_FOUND);
    const { request } = found;

    if (request.status !== "approved") return conflict("A Meet & Greet can be booked while the request is Approved.", "invalid_request_state");
    const slot = openSlot(request, slotId);
    if (!isSlot(slot)) return slot;

    const previous = activeBooking(request.id);
    if (previous) end(previous, "pet", "moved_to_another_day", null, slot);
    book(request, slot);
    return ok(withDetails(request), 201);
  }),

  // MG-05: the human confirms. The request becomes Meet Scheduled and the contact details open.
  route("POST", "/adoption-requests/:requestId/meet-and-greet/confirm", ({ params, account }) => {
    const found = requestFor(params.requestId, account, ["human"]);
    if (!found) return fail(404, NOT_FOUND);
    const { request } = found;

    const booking = activeBooking(request.id);
    if (!booking || booking.status !== "booked") return conflict("There is no booking waiting for you to confirm.", "no_pending_booking");
    const slot = MEET_GREET_SLOTS.find((s) => s.id === booking.slot_id);
    if (!slot || new Date(slot.starts_at).getTime() <= Date.now()) return conflict("That time has already passed. Propose another time instead.", "slot_passed");

    const now = new Date().toISOString();
    booking.status = "confirmed";
    booking.confirmed_at = now;
    request.status = "meet_scheduled";
    request.meet_scheduled_at = now;
    request.expires_at = null;
    return ok(withDetails(request));
  }),

  // MG-06: the human offers another open slot. The booking ends and the pet books again.
  route("POST", "/adoption-requests/:requestId/meet-and-greet/propose-time", ({ params, body, account }) => {
    const slotId = slotIdOf(body, "proposed_slot_id", "slot_id");
    const read = readNote(((body ?? {}) as { message?: unknown }).message, "message");
    const errors: Record<string, string> = {};
    if (!isId(slotId)) errors.proposed_slot_id = "Choose one of your open slots.";
    if ("error" in read) errors.message = read.error;
    if ("error" in read || Object.keys(errors).length) return validationFailed(errors);

    const found = requestFor(params.requestId, account, ["human"]);
    if (!found) return fail(404, NOT_FOUND);
    const { request } = found;

    const booking = activeBooking(request.id);
    if (!booking) return conflict("There is no booking to move to another time.", "no_active_booking");
    const slot = openSlot(request, slotId);
    if (!isSlot(slot)) return slot;

    end(booking, "human", "moved_to_another_day", read.note, slot);
    reopenBooking(request);
    return ok(withDetails(request));
  }),

  // MG-04, MG-09: the pet moves its booking; the human confirms the new time.
  route("POST", "/adoption-requests/:requestId/meet-and-greet/reschedule", ({ params, body, account }) => {
    const found = requestFor(params.requestId, account, ["pet"]);
    if (!found) return fail(404, NOT_FOUND);
    const { request } = found;

    const slotId = slotIdOf(body, "slot_id", "meet_greet_slot_id");
    const read = readNote(((body ?? {}) as { reason?: unknown }).reason, "reason");
    const errors: Record<string, string> = {};
    if (!isId(slotId)) errors.slot_id = "Choose one of the open slots.";
    if ("error" in read) errors.reason = read.error;
    if ("error" in read || Object.keys(errors).length) return validationFailed(errors);

    const booking = activeBooking(request.id);
    if (!booking) return conflict("There is no booking to reschedule.", "no_active_booking");
    const slot = openSlot(request, slotId);
    if (!isSlot(slot)) return slot;

    end(booking, "pet", "moved_to_another_day", read.note, slot);
    book(request, slot);
    reopenBooking(request);
    return ok(withDetails(request));
  }),

  // MG-10: either side calls the meeting off, with a reason. Booking reopens.
  route("POST", "/adoption-requests/:requestId/meet-and-greet/cancel", ({ params, body, account }) => {
    const sent = (body ?? {}) as { reason?: unknown; details?: unknown };
    const read = readNote(sent.details, "details");
    const errors: Record<string, string> = {};
    if (!CANCEL_REASONS.includes(sent.reason)) errors.reason = "Choose a reason for cancelling the meeting.";
    if ("error" in read) errors.details = read.error;
    if ("error" in read || Object.keys(errors).length) return validationFailed(errors);

    const found = requestFor(params.requestId, account, ["pet", "human"]);
    if (!found) return fail(404, NOT_FOUND);
    const { request, side } = found;

    const booking = activeBooking(request.id);
    if (!booking) return conflict("There is no Meet & Greet to cancel.", "no_active_booking");

    end(booking, side, sent.reason as CancelReason, read.note);
    reopenBooking(request);
    return ok(withDetails(request));
  }),

  // MG-13: once its time has come, the human reports that the meeting didn't take place. Booking reopens.
  route("POST", "/adoption-requests/:requestId/meet-and-greet/didnt-happen", ({ params, body, account }) => {
    const sent = (body ?? {}) as { reason?: unknown; details?: unknown };
    const read = readNote(sent.details, "details");
    const errors: Record<string, string> = {};
    if (!DIDNT_HAPPEN_REASONS.includes(sent.reason)) errors.reason = "Choose what happened.";
    if ("error" in read) errors.details = read.error;
    if ("error" in read || Object.keys(errors).length) return validationFailed(errors);

    const found = requestFor(params.requestId, account, ["human"]);
    if (!found) return fail(404, NOT_FOUND);
    const { request } = found;

    if (!meetingPassed(request)) {
      return request.status === "meet_scheduled"
        ? conflict("The Meet & Greet time hasn't passed yet. Reschedule or cancel it instead.", "meeting_not_yet_passed")
        : conflict("This request isn't waiting for a decision.", "invalid_request_state");
    }

    // The meeting that was confirmed: still standing, or already ended when its time came.
    const booking = activeBooking(request.id) ?? MEET_AND_GREETS.findLast((b) => b.adoption_request_id === request.id);
    if (booking) end(booking, "human", sent.reason as DidntHappenReason, read.note);
    reopenBooking(request);
    return ok(withDetails(request));
  }),
];
