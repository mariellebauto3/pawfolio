import { describe, expect, it } from "vitest";
import { addSlots, getPastMeetings, getUpcomingSlots, removeSlot } from "@/features/meet-and-greet/api/slots";
import { PLACE_DETAILS_MAX, type SlotDraft, readSlotDraft, slotPlace, slotPlaceKind } from "@/features/meet-and-greet/schemas/slots";
import { type Transport, createApiClient } from "@/lib/api/core";
import { MOCK_PERSONA_COOKIE, createMockTransport } from "@/lib/api/mock/transport";

// A human's Meet & Greet availability against the mock API, which answers in the shapes of
// docs/api/adoption-and-meet-greet.md. Ana Santos (the `human` persona) offers four slots, the first of them booked
// by Mochi and confirmed. The mock keeps slots in memory for the whole file, so the tests that change it come last.
function as(persona: string) {
  return createApiClient(createMockTransport({ readCookie: (name) => (name === MOCK_PERSONA_COOKIE ? persona : null), writePersona: () => {}, latencyMs: 0 }));
}

/** A client whose API answers every call with `body`, and remembers what it was asked. */
function answering(body: unknown, status = 200) {
  const calls: { method: string; path: string; body?: unknown; query?: unknown }[] = [];
  const transport: Transport = async ({ method, path, body: sent, query }) => {
    calls.push({ method, path, body: sent, query });
    return { status, body, retryAfter: null };
  };
  return { client: createApiClient(transport), calls };
}

const NOW = new Date("2026-10-08T04:00:00.000Z"); // noon in the Philippines
const DRAFT: SlotDraft = { date: "2026-10-10", time: "10:00", placeType: "public_spot", placeDetails: "  UP Diliman Academic Oval ", repeats: false };
const page = (data: unknown[]) => ({ data, meta: { current_page: 1, last_page: 1, per_page: 50, total: data.length }, links: {} });

describe("a slot as it is typed (MG-02)", () => {
  it("reads the date and time as Philippine time, and trims the place", () => {
    expect(readSlotDraft(DRAFT, NOW)).toEqual({
      // 10:00 in the Philippines is 02:00 UTC.
      slot: { starts_at: "2026-10-10T02:00:00.000Z", place_type: "public_spot", place_details: "UP Diliman Academic Oval", repeat_weeks: 1 },
    });
    expect(readSlotDraft({ ...DRAFT, repeats: true }, NOW)).toMatchObject({ slot: { repeat_weeks: 4 } });
  });

  it("needs a date and a time that are still ahead, within 12 months", () => {
    expect(readSlotDraft({ ...DRAFT, date: "", time: "" }, NOW)).toEqual({ errors: { date: "Choose a date.", time: "Choose a time." } });
    // Earlier the same day, on the Philippine clock.
    expect(readSlotDraft({ ...DRAFT, date: "2026-10-08", time: "11:59" }, NOW)).toEqual({ errors: { time: "Choose a time that is still ahead." } });
    expect(readSlotDraft({ ...DRAFT, date: "2026-10-08", time: "12:01" }, NOW)).toHaveProperty("slot");
    expect(readSlotDraft({ ...DRAFT, date: "2027-10-09" }, NOW)).toEqual({ errors: { date: "Choose a date within the next 12 months." } });
    expect(readSlotDraft({ ...DRAFT, date: "2026-02-30" }, NOW)).toEqual({ errors: { date: "Choose a date and a time." } });
  });

  it("needs to know where to meet, unless it is at the caretaker's", () => {
    const missing = { errors: { place_details: "Say where to meet, such as the name of the park or the shelter." } };
    expect(readSlotDraft({ ...DRAFT, placeDetails: "   " }, NOW)).toEqual(missing);
    expect(readSlotDraft({ ...DRAFT, placeType: "shelter", placeDetails: "" }, NOW)).toEqual(missing);
    expect(readSlotDraft({ ...DRAFT, placeType: "caretaker_location", placeDetails: " " }, NOW)).toMatchObject({ slot: { place_type: "caretaker_location", place_details: null } });
    expect(readSlotDraft({ ...DRAFT, placeDetails: "a".repeat(PLACE_DETAILS_MAX + 1) }, NOW)).toEqual({
      errors: { place_details: "Keep the place details to 255 characters or fewer." },
    });
  });

  it("names a slot by its place, or by the kind of place when it has no name", () => {
    expect(slotPlace({ place_type: "shelter", place_details: "Happy Paws Rescue" })).toBe("Happy Paws Rescue");
    expect(slotPlaceKind({ place_type: "shelter", place_details: "Happy Paws Rescue" })).toBe("Shelter");
    expect(slotPlace({ place_type: "caretaker_location", place_details: null })).toBe("Caretaker’s location");
    expect(slotPlaceKind({ place_type: "caretaker_location", place_details: null })).toBeNull();
  });
});

describe("the availability calls (MG-01, MG-02)", () => {
  it("asks for the slots still ahead, and for the latest past meetings", async () => {
    const { client, calls } = answering(page([]));
    await getUpcomingSlots(client);
    await getUpcomingSlots(client, 3);
    await getPastMeetings(client);
    expect(calls.map((call) => call.query)).toEqual([
      { when: "upcoming", page: undefined, per_page: 50 },
      { when: "upcoming", page: 3, per_page: 50 },
      { when: "past", per_page: 10 },
    ]);
  });

  it("leaves out rows it can't show truthfully", async () => {
    const open = { id: 1, home_profile_id: 1, starts_at: "2026-10-10T02:00:00.000Z", place_type: "public_spot", place_details: "Oval", active_booking: null };
    const upcoming = await getUpcomingSlots(
      answering(page([open, { ...open, id: 2, starts_at: null }, { ...open, id: 3, active_booking: { status: "booked", adoption_request_id: 5 } }])).client,
    );
    // No time, or a booking that names no pet.
    expect(upcoming.data.map((slot) => slot.id)).toEqual([1]);

    const met = { id: 4, adoption_request_id: 5, pet_name: "Bantay", request_status: "awaiting_decision", end_reason: null, slot: open };
    const past = await getPastMeetings(answering(page([met, { ...met, id: 6, request_status: "paused" }, { ...met, id: 7, end_reason: "didnt_show_pet_side" }])).client);
    expect(past.data.map((meeting) => [meeting.id, meeting.didnt_happen])).toEqual([
      [4, false],
      [7, true],
    ]);
  });

  it("refuses an answer that isn't a page, or that added nothing", async () => {
    await expect(getUpcomingSlots(answering({ data: [] }).client)).rejects.toThrow("We couldn't load your Meet & Greet slots. Please try again.");
    await expect(addSlots(answering({ data: [] }, 201).client, { starts_at: "2026-10-10T02:00:00.000Z", place_type: "shelter", place_details: "Happy Paws", repeat_weeks: 1 })).rejects.toThrow(
      "We couldn't tell whether the slot was added. Reload the page to check before adding it again.",
    );
  });

  it("lists a human's upcoming slots, soonest first, with who booked them", async () => {
    const slots = await getUpcomingSlots(as("human"));
    expect(slots.meta.total).toBe(4);
    expect(slots.data.map((slot) => [slot.id, slot.place_type, slot.booking?.pet_name ?? null])).toEqual([
      [1, "shelter", "Mochi"],
      [2, "public_spot", null],
      [3, "caretaker_location", null],
      [4, "public_spot", null],
    ]);
    expect(slots.data[0].booking).toEqual({ status: "confirmed", adoption_request_id: 1, pet_name: "Mochi" });
    // No meeting's time has come yet.
    expect((await getPastMeetings(as("human"))).meta.total).toBe(0);
  });

  it("keeps slots for humans only", async () => {
    await expect(getUpcomingSlots(as("pet"))).rejects.toMatchObject({ kind: "forbidden" });
    await expect(addSlots(as("pet"), { starts_at: "2099-01-01T02:00:00.000Z", place_type: "shelter", place_details: "Happy Paws", repeat_weeks: 1 })).rejects.toMatchObject({
      kind: "forbidden",
    });
    await expect(getUpcomingSlots(as("pet-pending"))).rejects.toMatchObject({ kind: "account_not_active" });
  });

  // From here on the slots change.

  it("adds a slot, or the same slot for four weeks, and never two at the same time", async () => {
    const day = 24 * 60 * 60 * 1000;
    const startsAt = new Date(Math.ceil(Date.now() / day) * day + 20 * day).toISOString();
    const body = { starts_at: startsAt, place_type: "public_spot" as const, place_details: "Ayala Triangle Gardens", repeat_weeks: 1 };

    const [added] = await addSlots(as("human"), body);
    expect(added).toMatchObject({ home_profile_id: 1, place_type: "public_spot", place_details: "Ayala Triangle Gardens" });
    expect(new Date(added.starts_at).getTime()).toBe(new Date(startsAt).getTime());

    await expect(addSlots(as("human"), body)).rejects.toMatchObject({ kind: "validation", fieldErrors: { starts_at: "You already have a slot at that time." } });

    const weekly = await addSlots(as("human"), { ...body, starts_at: new Date(new Date(startsAt).getTime() + day).toISOString(), repeat_weeks: 4 });
    expect(weekly).toHaveLength(4);
    expect(new Date(weekly[3].starts_at).getTime() - new Date(weekly[0].starts_at).getTime()).toBe(21 * day);
    expect((await getUpcomingSlots(as("human"))).meta.total).toBe(9);

    await expect(addSlots(as("human"), { ...body, starts_at: "2020-01-01T02:00:00.000Z" })).rejects.toMatchObject({
      kind: "validation",
      fieldErrors: { starts_at: "Choose a time that is still ahead." },
    });
    await expect(addSlots(as("human"), { ...body, starts_at: new Date(new Date(startsAt).getTime() + 2 * day).toISOString(), place_details: null })).rejects.toMatchObject({
      kind: "validation",
      fieldErrors: { place_details: "Say where to meet, such as the name of the park or the shelter." },
    });
  });

  it("removes an open slot, and keeps one a pet has booked", async () => {
    await removeSlot(as("human"), 2);
    expect((await getUpcomingSlots(as("human"))).data.map((slot) => slot.id)).not.toContain(2);
    await expect(removeSlot(as("human"), 2)).rejects.toMatchObject({ kind: "not_found" });

    await expect(removeSlot(as("human"), 1)).rejects.toMatchObject({ kind: "conflict", code: "slot_has_active_booking" });
    expect((await getUpcomingSlots(as("human"))).data.map((slot) => slot.id)).toContain(1);
  });
});
