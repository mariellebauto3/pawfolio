import { describe, expect, it } from "vitest";
import { getMyRequests, getOwnRequests, getRequest, sendRequest, withdrawRequest } from "@/features/adoption-requests/api/requests";
import { REQUEST_STEPS, requestRowDates, requestStep, requestTimeline } from "@/features/adoption-requests/schemas/request-status";
import {
  COVER_LETTER_MAX,
  COVER_LETTER_MIN,
  requestBody,
  requestTabFromUrl,
  requestTotals,
  requestsHref,
  validateCaretakerNotes,
  validateCoverLetter,
} from "@/features/adoption-requests/schemas/requests";
import { type Transport, createApiClient } from "@/lib/api/core";
import { ADOPTION_REQUESTS } from "@/lib/api/mock/fixtures/adoption-requests";
import { MOCK_PERSONA_COOKIE, createMockTransport } from "@/lib/api/mock/transport";
import type { AdoptionRequest } from "@/types/adoption-request";
import type { RequestStatus } from "@/types/statuses";

// The pet's adoption request calls against the mock API, which answers in the shapes of
// docs/api/adoption-and-meet-greet.md. The mock keeps requests in memory for the whole file, so the tests that
// change it come last.
function as(persona: string) {
  return createApiClient(createMockTransport({ readCookie: (name) => (name === MOCK_PERSONA_COOKIE ? persona : null), writePersona: () => {}, latencyMs: 0 }));
}

/** A client whose API answers every call with `body`, and remembers what it was asked. */
function answering(body: unknown) {
  const calls: { method: string; path: string; body?: unknown; query?: unknown }[] = [];
  const transport: Transport = async ({ method, path, body: sent, query }) => {
    calls.push({ method, path, body: sent, query });
    return { status: 200, body, retryAfter: null };
  };
  return { client: createApiClient(transport), calls };
}

const LETTER = "I am calm indoors and I love long walks, which sounds just like your weekends.";

function request(status: RequestStatus, change: Partial<AdoptionRequest> = {}): AdoptionRequest {
  return { ...ADOPTION_REQUESTS[0], status, sent_at: "2026-09-20T01:00:00.000Z", expires_at: null, approved_at: null, meet_scheduled_at: null, closed_at: null, ...change };
}

describe("the cover letter and the notes (RQ-03)", () => {
  it("takes a letter of 50 to 600 characters, counted after trimming", () => {
    expect(validateCoverLetter("a".repeat(COVER_LETTER_MIN))).toBeNull();
    expect(validateCoverLetter("a".repeat(COVER_LETTER_MAX))).toBeNull();
    expect(validateCoverLetter(` ${"a".repeat(COVER_LETTER_MAX)} `)).toBeNull();
    expect(validateCoverLetter("")).toBe("Write between 50 and 600 characters.");
    expect(validateCoverLetter(`${" ".repeat(20)}${"a".repeat(COVER_LETTER_MIN - 1)}`)).toBe("Write between 50 and 600 characters.");
    expect(validateCoverLetter("a".repeat(COVER_LETTER_MAX + 1))).toBe("Write between 50 and 600 characters.");
  });

  it("takes notes of up to 600 characters, or none", () => {
    expect(validateCaretakerNotes("")).toBeNull();
    expect(validateCaretakerNotes("a".repeat(600))).toBeNull();
    expect(validateCaretakerNotes("a".repeat(601))).toBe("Keep the notes to 600 characters or fewer.");
  });

  it("sends both trimmed, and no notes at all when they are empty", () => {
    expect(requestBody(`  ${LETTER}\n`, "  Walks twice a day. ")).toEqual({ cover_letter: LETTER, caretaker_notes: "Walks twice a day." });
    expect(requestBody(LETTER, "   ")).toEqual({ cover_letter: LETTER, caretaker_notes: null });
  });
});

describe("the My requests address and counts (RQ-07, RQ-08)", () => {
  it("reads the tab, and falls back to Active", () => {
    expect(requestTabFromUrl("closed")).toBe("closed");
    expect(requestTabFromUrl(["closed", "active"])).toBe("closed");
    expect(requestTabFromUrl("active")).toBe("active");
    expect(requestTabFromUrl("everything")).toBe("active");
    expect(requestTabFromUrl(undefined)).toBe("active");
  });

  it("writes the address of a tab and a page, keeping the defaults out of it", () => {
    expect(requestsHref()).toBe("/requests");
    expect(requestsHref("active", 2)).toBe("/requests?page=2");
    expect(requestsHref("closed")).toBe("/requests?tab=closed");
    expect(requestsHref("closed", 3)).toBe("/requests?tab=closed&page=3");
  });

  it("adds the statuses up into open, in process and closed", () => {
    expect(requestTotals({ sent: 1, on_hold: 1, meet_scheduled: 1, declined: 2, withdrawn: 1, adopted: 1 })).toEqual({ open: 3, inProcess: 1, closed: 4 });
    expect(requestTotals({})).toEqual({ open: 0, inProcess: 0, closed: 0 });
  });
});

describe("how a request's status is told (RQ-14…RQ-17)", () => {
  it("places every open status on the path, and no ending but an adoption", () => {
    expect(REQUEST_STEPS).toHaveLength(5);
    expect((["sent", "on_hold", "approved", "meet_scheduled", "awaiting_decision", "adopted"] as const).map(requestStep)).toEqual([0, 0, 1, 2, 3, 4]);
    expect((["declined", "not_adopted", "withdrawn", "closed", "expired"] as const).map(requestStep)).toEqual([null, null, null, null, null]);
  });

  it("dates a row by when it was sent and the latest thing that happened", () => {
    expect(requestRowDates(request("sent", { expires_at: "2026-10-04T01:00:00.000Z" }))).toEqual(["Sent Sep 20, 2026", "Expires Oct 4, 2026"]);
    expect(requestRowDates(request("on_hold"))).toEqual(["Sent Sep 20, 2026"]);
    expect(requestRowDates(request("approved", { approved_at: "2026-09-22T01:00:00.000Z" }))).toEqual(["Sent Sep 20, 2026", "Approved Sep 22, 2026"]);
    expect(requestRowDates(request("declined", { closed_at: "2026-09-25T01:00:00.000Z" }))).toEqual(["Sent Sep 20, 2026", "Declined Sep 25, 2026"]);
    expect(requestRowDates(request("not_adopted", { closed_at: "2026-09-25T01:00:00.000Z" }))[1]).toBe("Not Adopted Sep 25, 2026");
    // A date that isn't one is left out, not shown as text.
    expect(requestRowDates(request("withdrawn", { sent_at: "soon", closed_at: null }))).toEqual([]);
  });

  it("tells a Sent request's history, with the day it expires still to come", () => {
    const events = requestTimeline(request("sent", { expires_at: "2026-10-04T01:00:00.000Z" }));
    expect(events).toEqual([
      { id: "sent", title: "You sent the request", at: "2026-09-20T01:00:00.000Z", status: "Sent" },
      { id: "expires", title: "Expires if Ana Santos hasn’t answered", at: "2026-10-04T01:00:00.000Z", upcoming: true },
    ]);
  });

  it("tells an ending in the pet's words, and nothing it has no date for", () => {
    const declined = requestTimeline(request("declined", { closed_at: "2026-09-25T01:00:00.000Z" }));
    expect(declined.map((event) => [event.title, event.status])).toEqual([
      ["You sent the request", "Sent"],
      ["Ana Santos declined the request", "Declined"],
    ]);

    const withdrawn = requestTimeline(request("withdrawn", { approved_at: "2026-09-22T01:00:00.000Z", closed_at: "2026-09-23T01:00:00.000Z" }));
    expect(withdrawn.map((event) => event.title)).toEqual(["You sent the request", "Ana Santos approved the request", "You withdrew the request"]);

    // On Hold has no date of its own, and an ending without one isn't dated by guessing.
    expect(requestTimeline(request("on_hold")).map((event) => event.id)).toEqual(["sent"]);
    expect(requestTimeline(request("expired")).map((event) => event.id)).toEqual(["sent"]);
    expect(requestTimeline(request("sent", { sent_at: "soon" }))).toEqual([]);
  });
});

describe("My requests (RQ-07, RQ-08)", () => {
  it("gives a pet its open requests, newest first, with the count of every status", async () => {
    const page = await getMyRequests(as("pet"), "active");
    expect(page.data.map((row) => [row.home_profile.full_name, row.status])).toEqual([
      ["Ana Santos", "meet_scheduled"],
      ["Paolo Garcia", "on_hold"],
    ]);
    expect(page.meta.total).toBe(2);
    // Every status is counted, whatever the tab.
    expect(page.counts).toEqual({ meet_scheduled: 1, on_hold: 1, declined: 1 });
    // The home is named by public facts only (SEC-PRIV-03).
    expect(page.data[0].home_profile).toEqual({
      id: 1,
      full_name: "Ana Santos",
      city: "Quezon City",
      profile_photo_url: null,
      is_furparent: true,
      home_type: "condo",
      household_members: ["just_me"],
    });
  });

  it("gives the closed ones on their own tab", async () => {
    const page = await getMyRequests(as("pet"), "closed");
    expect(page.data.map((row) => [row.home_profile.full_name, row.status, row.decline_reason])).toEqual([["Marco Reyes", "declined", "not_adopting_now"]]);
  });

  it("asks for the tab and a page of ten, and for page 1 without naming it", async () => {
    const { client, calls } = answering({ data: [], meta: { total: 0, current_page: 1, last_page: 1 } });
    await getMyRequests(client, "active");
    await getMyRequests(client, "closed", 3);
    expect(calls.map((call) => call.query)).toEqual([
      { tab: "active", page: undefined, per_page: 10 },
      { tab: "closed", page: 3, per_page: 10 },
    ]);
  });

  it("refuses an answer that isn't a page, and reads the rest strictly", async () => {
    await expect(getMyRequests(answering({ data: "nope" }).client, "active")).rejects.toMatchObject({ kind: "server" });

    const meta = { total: 4, current_page: 1, last_page: 1, status_counts: { sent: 2, hired: 9, declined: "1", on_hold: 0 } };
    const good = { ...ADOPTION_REQUESTS[1], decline_reason: "bored", expires_at: 5, home_profile: { id: 3, full_name: "Paolo Garcia", home_type: "castle", household_members: "many", street_address: "12 Sample St." } };
    const rows = [good, { ...ADOPTION_REQUESTS[1], status: "hired" }, { ...ADOPTION_REQUESTS[1], home_profile: null }, null];
    const page = await getMyRequests(answering({ data: rows, meta }).client, "active");

    // Rows that aren't requests are left out; odd values on the one that is are "not there".
    expect(page.data).toHaveLength(1);
    expect(page.data[0]).toMatchObject({ id: 2, decline_reason: null, expires_at: null });
    expect(page.data[0].home_profile).toEqual({ id: 3, full_name: "Paolo Garcia", city: "", profile_photo_url: null, is_furparent: false, home_type: null, household_members: [] });
    // Only real counts of known statuses are kept.
    expect(page.counts).toEqual({ sent: 2 });
  });

  it("is closed to admins and to accounts that aren't active", async () => {
    await expect(getMyRequests(as("admin"), "active")).rejects.toMatchObject({ kind: "forbidden" });
    await expect(getMyRequests(as("pet-suspended"), "active")).rejects.toMatchObject({ kind: "account_not_active" });
    await expect(getMyRequests(as("signed-out"), "active")).rejects.toMatchObject({ kind: "unauthenticated" });
  });

  it("reads the pet's latest requests for the Apply button", async () => {
    const requests = await getOwnRequests(as("pet"));
    expect(requests.map((row) => [row.home_profile.id, row.status])).toEqual([
      [4, "declined"],
      [1, "meet_scheduled"],
      [3, "on_hold"],
    ]);
    // An answer that isn't a list is no requests, so the page still offers Apply and the API answers for the rules.
    expect(await getOwnRequests(answering({ message: "nope" }).client)).toEqual([]);
  });
});

describe("one request (RQ-14, RQ-15, RQ-17)", () => {
  it("gives the pet its request with the match, and the cooldown once it was declined", async () => {
    const onHold = await getRequest(as("pet"), 2);
    expect(onHold).toMatchObject({ id: 2, status: "on_hold", match_score: 78, cooldown_until: null });

    const declined = await getRequest(as("pet"), 5);
    expect(declined).toMatchObject({ status: "declined", decline_reason: "not_adopting_now", decision_message: expect.stringContaining("wait a few months") });
    // 30 days after it closed, which was 8 days ago.
    const daysLeft = (new Date(declined.cooldown_until as string).getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(daysLeft).toBeGreaterThan(21.9);
    expect(daysLeft).toBeLessThan(22.1);
  });

  it("answers 404 for a request that isn't the pet's own", async () => {
    await expect(getRequest(as("pet"), 3)).rejects.toMatchObject({ kind: "not_found" });
    await expect(getRequest(as("pet"), 999)).rejects.toMatchObject({ kind: "not_found" });
  });

  it("refuses an answer that isn't a request", async () => {
    await expect(getRequest(answering({ data: { id: 2, status: "hired" } }).client, 2)).rejects.toMatchObject({ kind: "server" });
    await expect(getRequest(answering({ data: null }).client, 2)).rejects.toMatchObject({ kind: "server" });
  });
});

describe("sending and withdrawing (RQ-03, RQ-04, RQ-16)", () => {
  it("sends only the two texts, to the home in the path", async () => {
    const { client, calls } = answering({ data: ADOPTION_REQUESTS[1], meta: { open_requests: 2, max_open_requests: 3 } });
    const sent = await sendRequest(client, 3, { cover_letter: LETTER, caretaker_notes: null });
    expect(calls).toEqual([{ method: "POST", path: "/home-profiles/3/adoption-requests", body: { cover_letter: LETTER, caretaker_notes: null }, query: undefined }]);
    expect(sent.request.id).toBe(2);
    expect(sent.openRequests).toBe(2);

    // Without a count the screen leaves it out; without a request nothing is claimed.
    expect((await sendRequest(answering({ data: ADOPTION_REQUESTS[1] }).client, 3, { cover_letter: LETTER, caretaker_notes: null })).openRequests).toBeNull();
    await expect(sendRequest(answering({ data: {} }).client, 3, { cover_letter: LETTER, caretaker_notes: null })).rejects.toMatchObject({ kind: "server" });
  });

  it("is refused while the pet is in process, and for a home it may not open", async () => {
    const body = { cover_letter: LETTER, caretaker_notes: null };
    await expect(sendRequest(as("pet"), 1, body)).rejects.toMatchObject({ kind: "conflict", code: "pet_in_process" });
    await expect(sendRequest(as("pet"), 999, body)).rejects.toMatchObject({ kind: "not_found" });
    // Carla's Open to Adopt is off and Mochi has no request with her: her home answers like one that isn't there.
    await expect(sendRequest(as("pet"), 2, body)).rejects.toMatchObject({ kind: "not_found" });
    await expect(sendRequest(as("pet"), 1, { cover_letter: "Too short", caretaker_notes: null })).rejects.toMatchObject({
      kind: "validation",
      fieldErrors: { cover_letter: "Write between 50 and 600 characters." },
    });
    // Only a pet applies.
    await expect(sendRequest(as("human"), 3, body)).rejects.toMatchObject({ kind: "forbidden" });
  });

  it("lets only the pet that sent it withdraw, with a reason from the list", async () => {
    // Pepper's request to Ana is not Mochi's, and a human doesn't withdraw.
    await expect(withdrawRequest(as("pet"), 3, null)).rejects.toMatchObject({ kind: "not_found" });
    await expect(withdrawRequest(as("human"), 1, null)).rejects.toMatchObject({ kind: "not_found" });
    await expect(withdrawRequest(as("pet"), 1, "bored" as never)).rejects.toMatchObject({ kind: "validation", fieldErrors: { withdraw_reason: expect.any(String) } });
    // One that has ended can't be withdrawn.
    await expect(withdrawRequest(as("pet"), 5, null)).rejects.toMatchObject({ kind: "conflict", code: "request_already_closed" });
  });

  it("withdraws the request in process, which frees the pet and its request On Hold", async () => {
    const pet = as("pet");
    const withdrawn = await withdrawRequest(pet, 1, "found_better_match");
    expect(withdrawn).toMatchObject({ id: 1, status: "withdrawn", withdraw_reason: "found_better_match", expires_at: null });
    expect(withdrawn.closed_at).not.toBeNull();

    // Paolo's is Sent again, with a new expiry, and still dated the day it was sent.
    const restored = await getRequest(pet, 2);
    expect(restored).toMatchObject({ status: "sent", sent_at: "2026-09-19T16:00:00.000000Z" });
    expect(new Date(restored.expires_at as string).getTime()).toBeGreaterThan(Date.now());
    expect((await getMyRequests(pet, "closed")).counts).toEqual({ sent: 1, withdrawn: 1, declined: 1 });
  });

  it("then sends a request, counts it, and refuses a second one to the same home", async () => {
    const pet = as("pet");
    const sent = await sendRequest(pet, 1, requestBody(`  ${LETTER} `, " "));
    expect(sent.request).toMatchObject({ status: "sent", cover_letter: LETTER, caretaker_notes: null, home_profile: { full_name: "Ana Santos" } });
    expect(sent.openRequests).toBe(2);
    // 14 days to answer.
    const days = (new Date(sent.request.expires_at as string).getTime() - new Date(sent.request.sent_at as string).getTime()) / (24 * 60 * 60 * 1000);
    expect(days).toBe(14);

    const body = { cover_letter: LETTER, caretaker_notes: null };
    await expect(sendRequest(pet, 1, body)).rejects.toMatchObject({ kind: "conflict", code: "request_already_open" });
    // Marco declined a week ago.
    await expect(sendRequest(pet, 4, body)).rejects.toMatchObject({ kind: "conflict", code: "request_cooldown" });
  });
});
