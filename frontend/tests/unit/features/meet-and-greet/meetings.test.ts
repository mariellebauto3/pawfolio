import { describe, expect, it } from "vitest";
import { getRequestWith } from "@/features/adoption-requests/api/requests";
import { bookSlot, cancelMeeting, confirmBooking, proposeTime, readRequestMeeting, rescheduleMeeting } from "@/features/meet-and-greet/api/meetings";
import { MEET_NOTE_MAX, bookingNotice, meetNote, meetStage, slotsWithOfferFirst, validateMeetNote } from "@/features/meet-and-greet/schemas/meetings";
import { type Transport, createApiClient } from "@/lib/api/core";
import { MOCK_PERSONA_COOKIE, createMockTransport } from "@/lib/api/mock/transport";
import type { MeetAndGreet, MeetGreetSlot } from "@/types/meet-and-greet";

// The Meet & Greet calls against the mock API, which answers in the shapes of
// docs/api/adoption-and-meet-greet.md. Mochi (the `pet` persona) has a confirmed Meet & Greet with Ana Santos (the
// `human` persona) on request 1, on the first of Ana's four slots. The mock keeps bookings in memory for the whole
// file, so the tests that change it come last and follow one booking through its life.
function as(persona: string) {
  return createApiClient(createMockTransport({ readCookie: (name) => (name === MOCK_PERSONA_COOKIE ? persona : null), writePersona: () => {}, latencyMs: 0 }));
}

/** A client whose API answers every call with `body`, and remembers what it was asked. */
function answering(body: unknown) {
  const calls: { method: string; path: string; body?: unknown }[] = [];
  const transport: Transport = async ({ method, path, body: sent }) => {
    calls.push({ method, path, body: sent });
    return { status: 200, body, retryAfter: null };
  };
  return { client: createApiClient(transport), calls };
}

const meetingOf = async (persona: string) => (await getRequestWith(as(persona), 1, readRequestMeeting)).more;

const slot = (id: number, startsAt = "2026-10-10T02:00:00.000Z"): MeetGreetSlot => ({
  id,
  home_profile_id: 1,
  starts_at: startsAt,
  place_type: "public_spot",
  place_details: "UP Diliman Academic Oval",
});

function booking(change: Partial<MeetAndGreet> = {}): MeetAndGreet {
  return {
    id: 1,
    status: "booked",
    booked_at: "2026-10-01T02:00:00.000Z",
    confirmed_at: null,
    ended_at: null,
    ended_by: null,
    end_reason: null,
    end_details: null,
    slot: slot(1),
    proposed_slot: null,
    ...change,
  };
}

describe("where a Meet & Greet stands (MG-03…MG-08)", () => {
  it("is at booking while the request is Approved and nothing is booked", () => {
    expect(meetStage("approved", { active: null })).toBe("book");
  });

  it("waits for the human once a slot is booked, and is scheduled once it is confirmed", () => {
    expect(meetStage("approved", { active: booking() })).toBe("booked");
    expect(meetStage("meet_scheduled", { active: booking({ status: "confirmed" }) })).toBe("scheduled");
  });

  it("has no step for any other status, or when the status and the booking disagree", () => {
    for (const status of ["sent", "on_hold", "awaiting_decision", "adopted", "declined", "withdrawn"] as const) {
      expect(meetStage(status, { active: null })).toBeNull();
    }
    expect(meetStage("meet_scheduled", { active: null })).toBeNull();
    expect(meetStage("meet_scheduled", { active: booking() })).toBeNull();
    expect(meetStage("approved", { active: booking({ status: "confirmed" }) })).toBeNull();
  });
});

describe("why booking is open again (MG-06, MG-10, MG-13)", () => {
  const ended = (change: Partial<MeetAndGreet>) => booking({ status: "ended", ended_at: "2026-10-05T02:00:00.000Z", ...change });

  it("says nothing while there is no ended booking with a reason", () => {
    expect(bookingNotice(null, "pet")).toBeNull();
    expect(bookingNotice(booking(), "pet")).toBeNull();
    expect(bookingNotice(ended({}), "pet")).toBeNull();
  });

  it("tells each side that the human offered another time", () => {
    const offer = ended({ ended_by: "human", end_reason: "moved_to_another_day", end_details: "Sunday works better.", proposed_slot: slot(4) });
    expect(bookingNotice(offer, "pet")).toEqual({ kind: "proposed", byReader: false, slot: slot(4), message: "Sunday works better." });
    expect(bookingNotice(offer, "human")).toMatchObject({ kind: "proposed", byReader: true });
  });

  it("is silent when the pet moved its own booking: the new one is already there", () => {
    expect(bookingNotice(ended({ ended_by: "pet", end_reason: "moved_to_another_day", proposed_slot: slot(4) }), "human")).toBeNull();
  });

  it("names who cancelled and why, in the dialog's words", () => {
    const cancelled = ended({ ended_by: "pet", end_reason: "pet_unwell", end_details: "Mochi has a fever." });
    expect(bookingNotice(cancelled, "pet")).toEqual({ kind: "cancelled", byReader: true, was: slot(1), reason: "Pet is unwell", details: "Mochi has a fever." });
    expect(bookingNotice(cancelled, "human")).toMatchObject({ kind: "cancelled", byReader: false });
  });

  it("reads a booking that ended after its time as a meeting that didn't happen", () => {
    const missed = ended({ ended_at: "2026-10-12T02:00:00.000Z", ended_by: "human", end_reason: "didnt_show_pet_side" });
    expect(bookingNotice(missed, "pet")).toEqual({ kind: "didnt_happen", was: slot(1) });
    // Even with a reason a cancellation shares.
    expect(bookingNotice(ended({ ended_at: "2026-10-12T02:00:00.000Z", ended_by: "human", end_reason: "other" }), "pet")).toMatchObject({ kind: "didnt_happen" });
  });

  it("puts the offered slot first while it can still be booked", () => {
    const offer = bookingNotice(ended({ ended_by: "human", end_reason: "moved_to_another_day", proposed_slot: slot(4) }), "pet");
    expect(slotsWithOfferFirst([slot(2), slot(3), slot(4)], offer)).toEqual({ slots: [slot(4), slot(2), slot(3)], offeredId: 4 });
    // Someone else booked it in the meantime: the list is left as it is.
    expect(slotsWithOfferFirst([slot(2), slot(3)], offer)).toEqual({ slots: [slot(2), slot(3)], offeredId: null });
    expect(slotsWithOfferFirst([slot(2)], null)).toEqual({ slots: [slot(2)], offeredId: null });
  });
});

describe("a note with a proposal, a reschedule or a cancellation", () => {
  it("takes up to 600 characters after trimming, and names what it is", () => {
    expect(validateMeetNote("", "reason")).toBeNull();
    expect(validateMeetNote(` ${"a".repeat(MEET_NOTE_MAX)} `, "reason")).toBeNull();
    expect(validateMeetNote("a".repeat(MEET_NOTE_MAX + 1), "reason")).toBe("Keep the reason to 600 characters or fewer.");
    expect(validateMeetNote("a".repeat(MEET_NOTE_MAX + 1), "details")).toBe("Keep the details to 600 characters or fewer.");
  });

  it("is sent trimmed, and not at all when it is empty", () => {
    expect(meetNote("  Sunday works better. ")).toBe("Sunday works better.");
    expect(meetNote("   ")).toBeNull();
  });
});

describe("reading the Meet & Greet off a request (SEC-PRIV-02)", () => {
  const contacts = { caretaker_name: "Liza Reyes", caretaker_contact_number: "0917 555 0142", human_full_name: "Ana Santos", human_contact_number: "0918 555 0117" };

  it("reads contact details only when the API says a confirmed meeting opened them", () => {
    expect(readRequestMeeting({ contact_unlocked: true, contacts }).contacts).toMatchObject({ caretaker_name: "Liza Reyes", human_street_address: null });
    expect(readRequestMeeting({ contact_unlocked: false, contacts }).contacts).toBeNull();
    expect(readRequestMeeting({ contacts }).contacts).toBeNull();
    expect(readRequestMeeting({ contact_unlocked: true, contacts: null }).contacts).toBeNull();
  });

  it("leaves out what isn't a slot or a booking it can show", () => {
    const meeting = readRequestMeeting({
      active_meet_and_greet: { id: 3, status: "booked", slot: null },
      latest_meet_and_greet: { id: 3, status: "paused" },
      available_slots: [slot(2), { id: 9, starts_at: "soon", place_type: "public_spot" }, { id: 10, starts_at: "2026-10-10T02:00:00.000Z", place_type: "my_house" }, null],
    });
    // A booking without its slot can't be shown or acted on.
    expect(meeting.active).toBeNull();
    expect(meeting.latest).toBeNull();
    expect(meeting.slots).toEqual([slot(2)]);
  });

  it("reads who ended a booking, and nobody when its time simply came", () => {
    const read = (ended_by: unknown) => readRequestMeeting({ latest_meet_and_greet: { id: 1, status: "ended", ended_by, slot: slot(1) } }).latest?.ended_by;
    expect(read("pet")).toBe("pet");
    expect(read("human")).toBe("human");
    expect(read(null)).toBeNull();
    expect(read("admin")).toBeNull();
  });
});

describe("the Meet & Greet calls (MG-03…MG-10)", () => {
  it("sends each change to its own endpoint, and never a status", async () => {
    const data = { id: 7, status: "approved", active_meet_and_greet: { id: 1, status: "booked", slot: slot(2) } };
    const { client, calls } = answering({ data });

    await bookSlot(client, 7, 2);
    await rescheduleMeeting(client, 7, { slotId: 2, reason: null });
    await proposeTime(client, 7, { slotId: 4, message: "Sunday works better." });
    expect(calls).toEqual([
      { method: "POST", path: "/adoption-requests/7/meet-and-greet", body: { slot_id: 2 } },
      { method: "POST", path: "/adoption-requests/7/meet-and-greet/reschedule", body: { slot_id: 2, reason: null } },
      { method: "POST", path: "/adoption-requests/7/meet-and-greet/propose-time", body: { proposed_slot_id: 4, message: "Sunday works better." } },
    ]);
  });

  it("doesn't vouch for a change the answer doesn't show", async () => {
    const problem = "We couldn't tell whether that went through. Reload the page to see where the Meet & Greet stands.";
    // Not a request at all.
    await expect(bookSlot(answering({ data: null }).client, 7, 2)).rejects.toThrow(problem);
    // A request, but nothing is booked on it.
    await expect(bookSlot(answering({ data: { id: 7, status: "approved" } }).client, 7, 2)).rejects.toThrow(problem);
    await expect(confirmBooking(answering({ data: { id: 7, status: "approved", active_meet_and_greet: { id: 1, status: "booked", slot: slot(2) } } }).client, 7)).rejects.toThrow(problem);
    // Cancelled, yet a booking still stands.
    await expect(
      cancelMeeting(answering({ data: { id: 7, status: "meet_scheduled", active_meet_and_greet: { id: 1, status: "confirmed", slot: slot(2) } } }).client, 7, { reason: "other", details: null }),
    ).rejects.toThrow(problem);
  });

  it("shows both sides the confirmed meeting with the other side's contact details", async () => {
    const forPet = await meetingOf("pet");
    expect(forPet.active).toMatchObject({ status: "confirmed", slot: { id: 1, place_type: "shelter" } });
    expect(forPet.contacts).toMatchObject({ human_full_name: "Ana Santos", human_contact_number: "0918 555 0117", human_street_address: "12 Sample St., Brgy. Example" });
    // The booked slot isn't one of the open ones.
    expect(forPet.slots.map((open) => open.id)).toEqual([2, 3, 4]);

    expect((await meetingOf("human")).contacts).toMatchObject({ caretaker_name: "Liza Reyes", caretaker_contact_number: "0917 555 0142" });
  });

  it("answers anyone but the two sides like a request that doesn't exist", async () => {
    await expect(cancelMeeting(as("admin"), 1, { reason: "other", details: null })).rejects.toMatchObject({ kind: "not_found" });
    // Confirming is the human's, booking the pet's.
    await expect(confirmBooking(as("pet"), 1)).rejects.toMatchObject({ kind: "not_found" });
    await expect(bookSlot(as("human"), 1, 2)).rejects.toMatchObject({ kind: "not_found" });
    await expect(bookSlot(as("pet"), 999, 2)).rejects.toMatchObject({ kind: "not_found" });
  });

  it("needs a reason from the list to cancel", async () => {
    await expect(cancelMeeting(as("pet"), 1, { reason: "didnt_show_pet_side" as never, details: null })).rejects.toMatchObject({
      kind: "validation",
      fieldErrors: { reason: "Choose a reason for cancelling the meeting." },
    });
    expect((await meetingOf("pet")).active?.status).toBe("confirmed");
  });

  // From here on the booking changes.

  it("cancels: booking reopens and the contact details close", async () => {
    const meeting = await cancelMeeting(as("pet"), 1, { reason: "pet_unwell", details: "Mochi has a fever." });
    expect(meeting.active).toBeNull();
    expect(meeting.latest).toMatchObject({ status: "ended", ended_by: "pet", end_reason: "pet_unwell", end_details: "Mochi has a fever." });
    expect(meeting.contacts).toBeNull();
    // The slot is open again.
    expect(meeting.slots.map((open) => open.id)).toEqual([1, 2, 3, 4]);

    const { request, more } = await getRequestWith(as("human"), 1, readRequestMeeting);
    expect(request.status).toBe("approved");
    expect(request.meet_scheduled_at).toBeNull();
    expect(more.contacts).toBeNull();
    expect(bookingNotice(more.latest, "human")).toMatchObject({ kind: "cancelled", byReader: false, reason: "Pet is unwell" });

    await expect(cancelMeeting(as("human"), 1, { reason: "other", details: null })).rejects.toMatchObject({ kind: "conflict", code: "no_active_booking" });
  });

  it("books an open slot, and only an open one", async () => {
    await expect(bookSlot(as("pet"), 1, 99)).rejects.toMatchObject({ kind: "conflict", code: "slot_unavailable" });

    const meeting = await bookSlot(as("pet"), 1, 2);
    expect(meeting.active).toMatchObject({ status: "booked", slot: { id: 2 } });
    // Nothing private until the human confirms.
    expect(meeting.contacts).toBeNull();
    expect(meetStage("approved", meeting)).toBe("booked");

    await expect(bookSlot(as("pet"), 1, 2)).rejects.toMatchObject({ kind: "conflict", code: "slot_unchanged" });
  });

  it("lets the human offer another time, which the pet then books", async () => {
    await expect(proposeTime(as("human"), 1, { slotId: 2, message: null })).rejects.toMatchObject({ kind: "conflict", code: "slot_unchanged" });

    const offered = await proposeTime(as("human"), 1, { slotId: 4, message: "Wednesday evening works better for us." });
    expect(offered.active).toBeNull();
    expect(bookingNotice(offered.latest, "pet")).toMatchObject({ kind: "proposed", byReader: false, slot: { id: 4 }, message: "Wednesday evening works better for us." });
    expect(slotsWithOfferFirst(offered.slots, bookingNotice(offered.latest, "pet")).offeredId).toBe(4);

    await expect(proposeTime(as("human"), 1, { slotId: 3, message: null })).rejects.toMatchObject({ kind: "conflict", code: "no_active_booking" });
    expect((await bookSlot(as("pet"), 1, 4)).active?.slot?.id).toBe(4);
  });

  it("confirms the booking: Meet Scheduled, and the contact details open", async () => {
    const meeting = await confirmBooking(as("human"), 1);
    expect(meeting.active).toMatchObject({ status: "confirmed", slot: { id: 4 } });
    expect(meeting.contacts).toMatchObject({ caretaker_name: "Liza Reyes" });
    expect((await getRequestWith(as("pet"), 1, readRequestMeeting)).request.status).toBe("meet_scheduled");

    await expect(confirmBooking(as("human"), 1)).rejects.toMatchObject({ kind: "conflict", code: "no_pending_booking" });
  });

  it("reschedules to another open slot, which the human confirms again", async () => {
    const meeting = await rescheduleMeeting(as("pet"), 1, { slotId: 2, reason: "My caretaker has a vet appointment that day." });
    expect(meeting.active).toMatchObject({ status: "booked", slot: { id: 2 } });
    // Approved again until the human confirms, so the contact details are closed.
    expect(meeting.contacts).toBeNull();
    expect((await getRequestWith(as("human"), 1, readRequestMeeting)).request.status).toBe("approved");

    await expect(rescheduleMeeting(as("pet"), 1, { slotId: 2, reason: null })).rejects.toMatchObject({ kind: "conflict", code: "slot_unchanged" });
    await expect(rescheduleMeeting(as("pet"), 1, { slotId: 3, reason: "a".repeat(601) })).rejects.toMatchObject({
      kind: "validation",
      fieldErrors: { reason: "Keep the reason to 600 characters or fewer." },
    });

    expect((await confirmBooking(as("human"), 1)).active?.status).toBe("confirmed");
  });
});
