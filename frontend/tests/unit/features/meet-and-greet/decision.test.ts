import { afterEach, describe, expect, it, vi } from "vitest";
import { getMyRequests, getRequest, getRequestWith } from "@/features/adoption-requests/api/requests";
import { declineAfterMeeting, readRequestMeeting, reportDidntHappen } from "@/features/meet-and-greet/api/meetings";
import { DIDNT_HAPPEN_LABELS, DIDNT_HAPPEN_REASONS, bookingNotice, didntHappenTold, meetStage, metSlot } from "@/features/meet-and-greet/schemas/meetings";
import { type Transport, createApiClient } from "@/lib/api/core";
import { MOCK_PERSONA_COOKIE, createMockTransport } from "@/lib/api/mock/transport";
import type { MeetAndGreet, MeetGreetSlot } from "@/types/meet-and-greet";

// The decision after a Meet & Greet (MG-11…MG-14) against the mock API, which answers in the shapes of
// docs/api/adoption-and-meet-greet.md. Ana Santos (the `human` persona) met Bantay yesterday, so request 7 waits for
// her decision; Mochi's meeting on request 1 is still three days ahead. The mock keeps requests in memory for the
// whole file, so the tests that change it come last.
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

const read = async (persona: string, requestId: number) => getRequestWith(as(persona), requestId, readRequestMeeting);

const slot = (id: number): MeetGreetSlot => ({ id, home_profile_id: 1, starts_at: "2026-10-10T02:00:00.000Z", place_type: "public_spot", place_details: "UP Diliman Academic Oval" });

const booking = (change: Partial<MeetAndGreet> = {}): MeetAndGreet => ({
  id: 1,
  status: "confirmed",
  booked_at: "2026-10-01T02:00:00.000Z",
  confirmed_at: "2026-10-02T02:00:00.000Z",
  ended_at: null,
  ended_by: null,
  end_reason: null,
  end_details: null,
  slot: slot(1),
  proposed_slot: null,
  ...change,
});

afterEach(() => {
  vi.useRealTimers();
});

describe("when the decision is open (MG-11, MG-12)", () => {
  it("is the human's once the request is Awaiting Decision", () => {
    expect(meetStage("awaiting_decision", { active: null })).toBe("decide");
    expect(meetStage("awaiting_decision", { active: null, passed: true })).toBe("decide");
  });

  it("is open from the meeting time itself, before the status has caught up", () => {
    const confirmed = booking();
    expect(meetStage("meet_scheduled", { active: confirmed, passed: false })).toBe("scheduled");
    expect(meetStage("meet_scheduled", { active: confirmed, passed: true })).toBe("decide");
    // No other status is ever at a decision, whatever a flag says.
    for (const status of ["sent", "on_hold", "approved", "adopted", "not_adopted", "declined", "withdrawn"] as const) {
      expect(meetStage(status, { active: null, passed: true })).not.toBe("decide");
    }
  });

  it("is about the booking that stands, or the one that ended when its time came", () => {
    expect(metSlot({ active: booking(), latest: booking({ id: 2, slot: slot(9) }) })?.id).toBe(1);
    expect(metSlot({ active: null, latest: booking({ status: "ended", slot: slot(9) }) })?.id).toBe(9);
    expect(metSlot({ active: null, latest: null })).toBeNull();
  });

  it("takes the API's word for it, and nothing else", () => {
    const base = { active_meet_and_greet: null, latest_meet_and_greet: null, available_slots: [] };
    expect(readRequestMeeting({ ...base, meeting_passed: true }).passed).toBe(true);
    for (const said of [false, "true", 1, null, undefined]) {
      expect(readRequestMeeting({ ...base, meeting_passed: said }).passed).toBe(false);
    }
  });

  it("gives both sides the meeting that took place, and each other's details while it is open", async () => {
    const human = await read("human", 7);
    expect(human.request.status).toBe("awaiting_decision");
    expect(meetStage(human.request.status, human.more)).toBe("decide");
    expect(human.more.active).toBeNull();
    expect(metSlot(human.more)).toMatchObject({ id: 6, place_details: "Quezon Memorial Circle" });
    expect(human.more.contacts).toMatchObject({ caretaker_name: "Rhea Santiago", human_full_name: "Ana Santos" });

    // A meeting still ahead is not at a decision.
    const ahead = await read("human", 1);
    expect(ahead.more.passed).toBe(false);
    expect(meetStage(ahead.request.status, ahead.more)).toBe("scheduled");
  });
});

describe("what happened instead (MG-13)", () => {
  it("offers the four the API names, in the human's own words", () => {
    expect(DIDNT_HAPPEN_REASONS).toEqual(["didnt_show_pet_side", "didnt_show_human_side", "moved_to_another_day", "other"]);
    expect(DIDNT_HAPPEN_LABELS.didnt_show_human_side).toBe("I couldn’t make it");
  });

  it("tells the pet's side the same four with the human named", () => {
    expect(didntHappenTold("didnt_show_pet_side", "Ana Santos")).toBe("Ana Santos reported that your side didn’t show up.");
    expect(didntHappenTold("didnt_show_human_side", "Ana Santos")).toBe("Ana Santos couldn’t make it.");
    for (const reason of DIDNT_HAPPEN_REASONS) expect(didntHappenTold(reason, "Ana Santos")).toContain("Ana Santos");
  });

  it("sends what happened and the details, and expects booking to be open again", async () => {
    const reopened = { data: { id: 7, status: "approved", active_meet_and_greet: null, meeting_passed: false } };
    const { client, calls } = answering(reopened);
    await reportDidntHappen(client, 7, { reason: "moved_to_another_day", details: null });
    expect(calls).toEqual([{ method: "POST", path: "/adoption-requests/7/meet-and-greet/didnt-happen", body: { reason: "moved_to_another_day", details: null } }]);

    // An answer that still has a meeting standing, or still waits for a decision, isn't one we can vouch for.
    await expect(reportDidntHappen(answering({ data: { id: 7, status: "awaiting_decision", meeting_passed: true } }).client, 7, { reason: "other", details: null })).rejects.toMatchObject({
      kind: "server",
    });
    await expect(reportDidntHappen(answering({ data: {} }).client, 7, { reason: "other", details: null })).rejects.toMatchObject({ kind: "server" });
  });
});

describe("declining after the meeting (MG-14)", () => {
  it("sends only the message, and expects the request to be Not Adopted", async () => {
    const { client, calls } = answering({ data: { id: 7, status: "not_adopted" } });
    await declineAfterMeeting(client, 7, "Thank you for bringing Bantay.");
    expect(calls).toEqual([{ method: "POST", path: "/adoption-requests/7/decline-after-meeting", body: { decision_message: "Thank you for bringing Bantay." } }]);

    await expect(declineAfterMeeting(answering({ data: { id: 7, status: "awaiting_decision" } }).client, 7, null)).rejects.toMatchObject({ kind: "server" });
  });
});

describe("the decision, against the API (MG-11…MG-14)", () => {
  it("is refused before the meeting time, and for anyone but the human it was sent to", async () => {
    const what = { reason: "other" as const, details: null };
    await expect(reportDidntHappen(as("human"), 1, what)).rejects.toMatchObject({ kind: "conflict", code: "meeting_not_yet_passed" });
    await expect(declineAfterMeeting(as("human"), 1, null)).rejects.toMatchObject({ kind: "conflict", code: "meeting_not_yet_passed" });
    // Declined long ago: nothing is waiting for a decision.
    await expect(declineAfterMeeting(as("human"), 4, null)).rejects.toMatchObject({ kind: "conflict", code: "invalid_request_state" });

    // The pet that sent it, an admin and a signed-out visitor get nowhere (SEC-AUTHZ-04).
    await expect(reportDidntHappen(as("pet"), 1, what)).rejects.toMatchObject({ kind: "not_found" });
    await expect(declineAfterMeeting(as("pet"), 1, null)).rejects.toMatchObject({ kind: "not_found" });
    await expect(declineAfterMeeting(as("admin"), 7, null)).rejects.toMatchObject({ kind: "not_found" });
    await expect(declineAfterMeeting(as("signed-out"), 7, null)).rejects.toMatchObject({ kind: "unauthenticated" });
  });

  it("checks what happened and how long the details are", async () => {
    await expect(reportDidntHappen(as("human"), 7, { reason: "schedule_conflict" as never, details: null })).rejects.toMatchObject({
      kind: "validation",
      fieldErrors: { reason: "Choose what happened." },
    });
    await expect(reportDidntHappen(as("human"), 7, { reason: "other", details: "a".repeat(601) })).rejects.toMatchObject({
      kind: "validation",
      fieldErrors: { details: "Keep the details to 600 characters or fewer." },
    });
    await expect(declineAfterMeeting(as("human"), 7, "a".repeat(601))).rejects.toMatchObject({ kind: "validation", fieldErrors: { decision_message: expect.any(String) } });
  });

  it("reopens booking when the meeting didn't happen, and says why to both sides", async () => {
    const meeting = await reportDidntHappen(as("human"), 7, { reason: "didnt_show_pet_side", details: "We waited for an hour." });
    expect(meeting).toMatchObject({ active: null, passed: false, contacts: null });
    expect(meeting.latest).toMatchObject({ status: "ended", ended_by: "human", end_reason: "didnt_show_pet_side", end_details: "We waited for an hour." });

    const reopened = await read("human", 7);
    expect(reopened.request).toMatchObject({ status: "approved", awaiting_decision_at: null, meet_scheduled_at: null, pet: { status: "in_process" } });
    expect(reopened.request.expires_at).not.toBeNull();
    expect(meetStage(reopened.request.status, reopened.more)).toBe("book");
    expect(bookingNotice(reopened.more.latest, "human")).toMatchObject({ kind: "didnt_happen", reason: "didnt_show_pet_side", details: "We waited for an hour." });

    // Nothing is left to report or to decide until a new meeting has taken place.
    await expect(reportDidntHappen(as("human"), 7, { reason: "other", details: null })).rejects.toMatchObject({ kind: "conflict", code: "invalid_request_state" });
    await expect(declineAfterMeeting(as("human"), 7, null)).rejects.toMatchObject({ kind: "conflict", code: "invalid_request_state" });
  });

  it("declines once the meeting time has passed, though the status still reads Meet Scheduled", async () => {
    // Mochi's meeting with Ana is three days ahead; five days on, its time is behind us.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 5 * 24 * 60 * 60 * 1000);

    const waiting = await read("pet", 1);
    expect(waiting.request.status).toBe("meet_scheduled");
    expect(waiting.more.passed).toBe(true);
    expect(meetStage(waiting.request.status, waiting.more)).toBe("decide");

    await declineAfterMeeting(as("human"), 1, "  Thank you for bringing Mochi.  ");

    const declined = await getRequest(as("pet"), 1);
    expect(declined).toMatchObject({ status: "not_adopted", decision_message: "Thank you for bringing Mochi.", pet: { status: "looking_for_a_home" } });
    // The 30-day wait with this home starts, and nothing private stays behind.
    expect(declined.cooldown_until).not.toBeNull();
    expect((await read("pet", 1)).more).toMatchObject({ active: null, passed: false, contacts: null });
    // Mochi's request to Paolo was On Hold: it is Sent again.
    expect((await getMyRequests(as("pet"), "active")).data.map((row) => [row.id, row.status])).toEqual([[2, "sent"]]);

    await expect(declineAfterMeeting(as("human"), 1, null)).rejects.toMatchObject({ kind: "conflict", code: "invalid_request_state" });
  });
});
