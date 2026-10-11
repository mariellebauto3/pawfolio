import { describe, expect, it } from "vitest";
import { getMonitoredRequest, getMonitoredRequests, getOverdueRequestCount, sendRequestReminder, toMonitoredRequest } from "@/features/adoption-requests/api/admin-requests";
import {
  adminRequestTimeline,
  daysWithoutDecision,
  meetingLines,
  monitorFiltersFromUrl,
  noReminderLine,
  overdueNote,
  requestIdFromUrl,
  waitingOnLine,
} from "@/features/adoption-requests/schemas/admin-requests";
import type { MonitoredRequestDetail } from "@/features/adoption-requests/types/admin-requests";
import { readBooking } from "@/features/meet-and-greet/api/meetings";
import { type Transport, createApiClient } from "@/lib/api/core";
import { isApiError } from "@/lib/api/errors";
import { ADOPTION_REQUESTS } from "@/lib/api/mock/fixtures/adoption-requests";
import { MOCK_PERSONA_COOKIE, createMockTransport } from "@/lib/api/mock/transport";

// The admin's monitor of adoption requests (RQ-18, RQ-19, MG-15, MG-16): what its address may ask for, how a
// request is told to an admin, and the calls against the mock API, which answers in the shapes of
// docs/api/adoption-and-meet-greet.md. The mock keeps what is changed in memory for the whole file.

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

const failure = async (run: () => Promise<unknown>) => {
  try {
    await run();
  } catch (problem) {
    if (isApiError(problem)) return problem;
    throw problem;
  }
  throw new Error("Expected the call to fail.");
};

const NOW = new Date("2026-10-10T04:00:00.000Z");
const SLOT = { id: 5, home_profile_id: 1, starts_at: "2026-10-01T02:00:00.000Z", place_type: "public_spot" as const, place_details: "Ayala Triangle Gardens" };
const MEETING = { id: 9, status: "ended" as const, booked_at: "2026-09-28T02:00:00.000Z", confirmed_at: "2026-09-29T02:00:00.000Z", ended_at: "2026-10-01T02:00:00.000Z", ended_by: null, end_reason: null, end_details: null, slot: SLOT, proposed_slot: null };

function record(change: Partial<MonitoredRequestDetail> = {}): MonitoredRequestDetail {
  return {
    ...ADOPTION_REQUESTS[0],
    status: "awaiting_decision",
    sent_at: "2026-09-20T01:00:00.000Z",
    expires_at: null,
    approved_at: "2026-09-22T01:00:00.000Z",
    meet_scheduled_at: "2026-09-29T02:00:00.000Z",
    awaiting_decision_at: "2026-10-01T02:00:00.000Z",
    overdue_flagged_at: null,
    closed_at: null,
    updated_at: "2026-10-01T02:00:00.000Z",
    is_overdue: false,
    meeting: MEETING,
    parties: { pet_user_id: 1, pet_email: "mochi@example.com", pet_account_status: "active", human_user_id: 2, human_email: "ana.santos@example.com", human_account_status: "active" },
    reminder: { waiting_on: "human", last_sent_at: null, can_send: true },
    resolutions: [],
    ...change,
  };
}

describe("the monitor's address", () => {
  it("keeps only the tab, status and search the API knows", () => {
    expect(monitorFiltersFromUrl({})).toEqual({ tab: "all", status: undefined, search: undefined });
    expect(monitorFiltersFromUrl({ tab: "overdue", status: "awaiting_decision", q: "  mochi " })).toEqual({ tab: "overdue", status: "awaiting_decision", search: "mochi" });
    expect(monitorFiltersFromUrl({ tab: "meet-and-greets" }).tab).toBe("meet-and-greets");
    // A status isn't something the address can invent, and nothing typed there is sent on as it is.
    expect(monitorFiltersFromUrl({ tab: "everything", status: "hired", q: "   " })).toEqual({ tab: "all", status: undefined, search: undefined });
    expect(monitorFiltersFromUrl({ tab: ["overdue", "all"], q: "x".repeat(300) }).search).toHaveLength(100);
  });

  it("reads a request's id only when it is a plain id", () => {
    expect(requestIdFromUrl("53")).toBe(53);
    for (const value of ["0", "-1", "5.5", "5/../6", "..%2Fadmin", "abc", ""]) expect(requestIdFromUrl(value)).toBeNull();
  });
});

describe("a request told to an admin", () => {
  it("counts the days a decision has been waited for", () => {
    expect(daysWithoutDecision(record(), NOW)).toBe(9);
    expect(overdueNote(record(), NOW)).toBe("No decision for 9 days");
    expect(overdueNote(record({ awaiting_decision_at: "2026-10-09T03:00:00.000Z" }), NOW)).toBe("No decision for 1 day");
    // Only a request that is Awaiting Decision is waiting for one.
    expect(daysWithoutDecision(record({ status: "approved" }), NOW)).toBeNull();
    expect(overdueNote(record({ awaiting_decision_at: null }), NOW)).toBe("");
  });

  it("says when and where the Meet & Greet is and what became of the booking", () => {
    expect(meetingLines(record())).toEqual({ when: "Thu, Oct 1, 10:00 AM", where: "Ayala Triangle Gardens", state: "Its time has passed" });
    expect(meetingLines(record({ meeting: { ...MEETING, status: "booked", confirmed_at: null, ended_at: null } }))?.state).toBe("Waiting for the human to confirm");
    expect(meetingLines(record({ meeting: { ...MEETING, status: "confirmed", ended_at: null } }))?.state).toBe("Confirmed");
    expect(meetingLines(record({ meeting: { ...MEETING, ended_by: "pet", end_reason: "pet_unwell" } }))?.state).toBe("Ended before it took place");
    expect(meetingLines(record({ meeting: null }))).toBeNull();
    // A place at the caretaker's has no name: it is said by its kind.
    expect(meetingLines(record({ meeting: { ...MEETING, slot: { ...SLOT, place_type: "caretaker_location", place_details: null } } }))?.where).toBe("Caretaker’s location");
  });

  it("names who the request waits on, and says why nobody can be reminded", () => {
    expect(waitingOnLine(record())).toBe("Waiting on Ana Santos to choose Adopt or Decline.");
    expect(waitingOnLine(record({ status: "sent" }))).toBe("Waiting on Ana Santos to approve or decline.");
    expect(waitingOnLine(record({ status: "approved" }))).toBe("Waiting on Ana Santos to confirm the Meet & Greet.");
    expect(waitingOnLine(record({ status: "approved", reminder: { waiting_on: "pet", last_sent_at: null, can_send: true } }))).toBe("Waiting on Mochi to book a Meet & Greet.");
    expect(waitingOnLine(record({ status: "on_hold", reminder: { waiting_on: null, last_sent_at: null, can_send: false } }))).toBeNull();

    const nobody = { waiting_on: null, last_sent_at: null, can_send: false };
    expect(noReminderLine(record({ status: "on_hold", reminder: nobody }))).toContain("On Hold");
    expect(noReminderLine(record({ status: "meet_scheduled", reminder: nobody }))).toContain("still ahead");
    expect(noReminderLine(record({ status: "declined", reminder: nobody }))).toContain("has ended");
    expect(noReminderLine(record({ reminder: { waiting_on: "human", last_sent_at: "2026-10-10T01:00:00.000Z", can_send: false } }))).toContain("last 24 hours");
  });

  it("tells the timeline by name, oldest first, with what admins changed and why", () => {
    const timeline = adminRequestTimeline(
      record({
        overdue_flagged_at: "2026-10-08T02:00:00.000Z",
        resolutions: [{ id: 3, action: "reopen_meet_greet_booking", reason: "Neither side showed up.", pet: { id: 1, name: "Mochi" }, adoption_request_id: 1, home_name: "Ana Santos", admin_name: "admin.jess", created_at: "2026-10-09T02:00:00.000Z" }],
      }),
    );

    expect(timeline.map((event) => event.title)).toEqual([
      "Mochi sent the request",
      "Ana Santos approved the request",
      "Mochi booked a Meet & Greet",
      "Ana Santos confirmed the Meet & Greet",
      "The meeting time passed",
      "Flagged overdue for follow-up",
      "admin.jess reopened Meet & Greet booking",
    ]);
    expect(timeline.at(-1)?.description).toBe("Reason: Neither side showed up.");
    expect(timeline[2].description).toBe("Thu, Oct 1, 10:00 AM, Ayala Triangle Gardens");
    // Neither side is "you" to an admin.
    expect(timeline.some((event) => /\byou\b/i.test(event.title))).toBe(false);
  });

  it("ends the timeline with how the request ended, and keeps what is still to come last", () => {
    const adopted = adminRequestTimeline(record({ status: "adopted", closed_at: "2026-10-02T02:00:00.000Z" }));
    expect(adopted.at(-1)).toMatchObject({ title: "Ana Santos adopted Mochi", status: "Adopted" });

    const sent = adminRequestTimeline(record({ status: "sent", approved_at: null, meet_scheduled_at: null, awaiting_decision_at: null, meeting: null, expires_at: "2026-10-04T01:00:00.000Z" }));
    expect(sent.map((event) => event.title)).toEqual(["Mochi sent the request", "Expires if Ana Santos hasn’t answered"]);
    expect(sent[1].upcoming).toBe(true);

    // An admin whose account is gone is still an admin, and a date that isn't one isn't an event.
    const closed = adminRequestTimeline(
      record({ status: "closed", closed_at: "2026-10-05T02:00:00.000Z", resolutions: [{ id: 4, action: "close_request", reason: "Duplicate.", pet: null, adoption_request_id: 1, home_name: null, admin_name: null, created_at: "not a date" }] }),
    );
    expect(closed.some((event) => event.id === "resolution-4")).toBe(false);
    expect(closed.at(-1)?.title).toBe("The request was closed");
  });
});

describe("reading what the API answers", () => {
  const ROW = { ...ADOPTION_REQUESTS[0], updated_at: "2026-10-01T02:00:00.000Z", is_overdue: true, latest_meet_and_greet: { ...MEETING, slot: SLOT } };

  it("keeps a request that matches the contract and treats anything but a plain true as not overdue", () => {
    expect(toMonitoredRequest(ROW, readBooking)).toMatchObject({ id: 1, is_overdue: true, meeting: { status: "ended", slot: { place_details: "Ayala Triangle Gardens" } } });
    expect(toMonitoredRequest({ ...ROW, is_overdue: "yes" }, readBooking)?.is_overdue).toBe(false);
    expect(toMonitoredRequest({ ...ROW, latest_meet_and_greet: { id: 1, status: "postponed" } }, readBooking)?.meeting).toBeNull();
    expect(toMonitoredRequest({ ...ROW, status: "teleported" }, readBooking)).toBeNull();
    expect(toMonitoredRequest(null, readBooking)).toBeNull();
  });

  it("offers a reminder only when the answer spells it out", async () => {
    const page = { ...ROW, parties: { pet_user_id: "1", human_user_id: 2, human_account_status: "banned" }, reminder: { waiting_on: "admin", can_send: true }, resolutions: [{ id: 1, action: "mark_adopted" }] };
    const request = await getMonitoredRequest(answering({ data: page }).client, 1, readBooking);
    expect(request.reminder).toEqual({ waiting_on: null, last_sent_at: null, can_send: false });
    expect(request.parties).toMatchObject({ pet_user_id: null, human_user_id: 2, human_account_status: null });
    expect(request.resolutions).toEqual([]);

    expect((await failure(() => getMonitoredRequest(answering({ data: { id: 1 } }).client, 1, readBooking))).kind).toBe("server");
    expect((await failure(() => getMonitoredRequests(answering({ data: "nope" }).client, readBooking))).kind).toBe("server");
  });
});

describe("what is sent", () => {
  it("asks the list in the API's own words and never sends a status to set", async () => {
    const { client, calls } = answering({ data: [], meta: { total: 0, current_page: 1, last_page: 1 }, links: {} });
    await getMonitoredRequests(client, readBooking, { tab: "meet-and-greets", status: "approved", search: "mochi", page: 2 });
    expect(calls[0]).toMatchObject({ method: "GET", path: "/admin/adoption-requests", query: { tab: "meet_and_greets", status: "approved", q: "mochi", page: 2 } });

    await getMonitoredRequests(client, readBooking, { tab: "all", page: 1 });
    expect(calls[1].query).toMatchObject({ tab: undefined, status: undefined, q: undefined, page: undefined });
  });

  it("sends a reminder with nothing but the request's id in the path", async () => {
    const { client, calls } = answering({ data: { reminded: true, recipient: "human", recipient_name: "Ana Santos" } });
    expect(await sendRequestReminder(client, 53)).toEqual({ recipient: "human", recipient_name: "Ana Santos" });
    expect(calls[0]).toMatchObject({ method: "POST", path: "/admin/adoption-requests/53/remind" });
    expect(calls[0].body).toBeUndefined();

    // An answer that doesn't say who was reminded isn't one we can vouch for.
    expect((await failure(() => sendRequestReminder(answering({ data: { reminded: true } }).client, 53))).kind).toBe("server");
  });
});

describe("against the mock API", () => {
  it("lists every request for an admin, by tab, and refuses a member", async () => {
    const admin = as("admin");
    const all = await getMonitoredRequests(admin, readBooking);
    expect(all.meta.total).toBe(ADOPTION_REQUESTS.length + 1);
    expect(all.data.every((request) => !("contacts" in request))).toBe(true);

    const overdue = await getMonitoredRequests(admin, readBooking, { tab: "overdue" });
    expect(overdue.data.map((request) => request.pet.name)).toEqual(["Tofu"]);
    expect(overdue.data[0]).toMatchObject({ is_overdue: true, status: "awaiting_decision", meeting: { status: "ended" } });
    expect(await getOverdueRequestCount(admin)).toBe(1);

    const meetings = await getMonitoredRequests(admin, readBooking, { tab: "meet-and-greets" });
    expect(meetings.data.every((request) => request.meeting !== null)).toBe(true);
    expect((await getMonitoredRequests(admin, readBooking, { search: "luna" })).data.map((request) => request.pet.name)).toEqual(["Luna"]);

    expect((await failure(() => getMonitoredRequests(as("pet"), readBooking))).status).toBe(403);
    expect((await failure(() => getMonitoredRequest(as("human"), 1, readBooking))).status).toBe(403);
  });

  it("reads a record without anyone's phone number or address", async () => {
    // Bantay's request waits for Ana's decision: the two sides read each other's contact details on it.
    const request = await getMonitoredRequest(as("admin"), 7, readBooking);
    expect(request).toMatchObject({ status: "awaiting_decision", reminder: { waiting_on: "human", can_send: true } });
    expect(JSON.stringify(request)).not.toMatch(/0917|0918|Sample St/);
    expect((await failure(() => getMonitoredRequest(as("admin"), 999, readBooking))).kind).toBe("not_found");
  });

  it("reminds once a day, and nobody when nobody has a step to take", async () => {
    const admin = as("admin");
    expect(await sendRequestReminder(admin, 7)).toEqual({ recipient: "human", recipient_name: "Ana Santos" });
    expect((await getMonitoredRequest(admin, 7, readBooking)).reminder.can_send).toBe(false);
    expect(await failure(() => sendRequestReminder(admin, 7))).toMatchObject({ kind: "conflict", code: "already_reminded" });
    // Mochi's request to Paolo is On Hold.
    expect(await failure(() => sendRequestReminder(admin, 2))).toMatchObject({ kind: "conflict", code: "no_reminder_needed" });
  });
});
