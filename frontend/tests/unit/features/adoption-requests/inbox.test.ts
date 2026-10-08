import { describe, expect, it } from "vitest";
import { approveRequest, declineRequest, getInbox, getMyRequests, getRequest } from "@/features/adoption-requests/api/requests";
import { inboxBadge, requestTimeline } from "@/features/adoption-requests/schemas/request-status";
import {
  ANSWER_MESSAGE_MAX,
  answerMessage,
  inboxHref,
  inboxTabFromUrl,
  inboxTotals,
  validateAnswerMessage,
} from "@/features/adoption-requests/schemas/requests";
import { type Transport, createApiClient } from "@/lib/api/core";
import { ADOPTION_REQUESTS } from "@/lib/api/mock/fixtures/adoption-requests";
import { MOCK_PERSONA_COOKIE, createMockTransport } from "@/lib/api/mock/transport";
import type { AdoptionRequest } from "@/types/adoption-request";
import type { RequestStatus } from "@/types/statuses";

// The human's adoption request calls against the mock API, which answers in the shapes of
// docs/api/adoption-and-meet-greet.md. The mock keeps requests in memory for the whole file, so the tests that
// change it come last. Ana Santos (the `human` persona) has three: Pepper's is new, Mochi's is Meet Scheduled and
// Tofu's was declined.
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

function request(status: RequestStatus, change: Partial<AdoptionRequest> = {}): AdoptionRequest {
  return { ...ADOPTION_REQUESTS[0], status, sent_at: "2026-09-20T01:00:00.000Z", expires_at: null, approved_at: null, meet_scheduled_at: null, closed_at: null, ...change };
}

describe("the inbox's address and counts (RQ-09, RQ-10)", () => {
  it("reads the tab, and falls back to New", () => {
    expect(inboxTabFromUrl("in-progress")).toBe("in-progress");
    expect(inboxTabFromUrl(["closed", "new"])).toBe("closed");
    expect(inboxTabFromUrl("new")).toBe("new");
    // A pet's tab, or anything else, is not one of the inbox's.
    expect(inboxTabFromUrl("active")).toBe("new");
    expect(inboxTabFromUrl(undefined)).toBe("new");
  });

  it("writes the address of a tab and a page, keeping the defaults out of it", () => {
    expect(inboxHref()).toBe("/requests");
    expect(inboxHref("new", 2)).toBe("/requests?page=2");
    expect(inboxHref("in-progress")).toBe("/requests?tab=in-progress");
    expect(inboxHref("closed", 3)).toBe("/requests?tab=closed&page=3");
  });

  it("shares every request out over the three tabs, On Hold with In progress", () => {
    const counts = { sent: 2, on_hold: 1, approved: 1, awaiting_decision: 1, declined: 3, adopted: 1 };
    expect(inboxTotals(counts)).toEqual({ new: 2, "in-progress": 3, closed: 4 });
    expect(inboxTotals({})).toEqual({ new: 0, "in-progress": 0, closed: 0 });
  });

  it("marks the two statuses that wait on the human, and names the rest", () => {
    expect(inboxBadge("sent")).toEqual({ label: "New", needsAnswer: true });
    expect(inboxBadge("awaiting_decision")).toEqual({ label: "Decision needed", needsAnswer: true });
    expect(inboxBadge("on_hold")).toEqual({ label: "On Hold", needsAnswer: false });
    expect(inboxBadge("declined")).toEqual({ label: "Declined", needsAnswer: false });
  });
});

describe("the message with an answer (RQ-12, RQ-13)", () => {
  it("is optional, and up to 600 characters after trimming", () => {
    expect(validateAnswerMessage("")).toBeNull();
    expect(validateAnswerMessage("a".repeat(ANSWER_MESSAGE_MAX))).toBeNull();
    expect(validateAnswerMessage(` ${"a".repeat(ANSWER_MESSAGE_MAX)} `)).toBeNull();
    expect(validateAnswerMessage("a".repeat(ANSWER_MESSAGE_MAX + 1))).toBe("Keep the message to 600 characters or fewer.");
  });

  it("is sent trimmed, and not at all when it is empty", () => {
    expect(answerMessage("  We'd love to meet you!  ")).toBe("We'd love to meet you!");
    expect(answerMessage("   ")).toBeNull();
  });
});

describe("a request's history as the human reads it (RQ-11)", () => {
  it("names the pet and says you for the human", () => {
    const sent = requestTimeline(request("sent", { expires_at: "2026-10-04T01:00:00.000Z" }), "human");
    expect(sent.map((event) => event.title)).toEqual(["Mochi sent the request", "Expires if you haven’t answered"]);

    const declined = requestTimeline(request("declined", { closed_at: "2026-09-25T01:00:00.000Z" }), "human");
    expect(declined.map((event) => [event.title, event.status])).toEqual([
      ["Mochi sent the request", "Sent"],
      ["You declined the request", "Declined"],
    ]);

    const withdrawn = requestTimeline(request("withdrawn", { approved_at: "2026-09-22T01:00:00.000Z", closed_at: "2026-09-23T01:00:00.000Z" }), "human");
    expect(withdrawn.map((event) => event.title)).toEqual(["Mochi sent the request", "You approved the request", "Mochi withdrew the request"]);
  });

  it("tells the same request to the pet in the pet's words", () => {
    const declined = request("declined", { closed_at: "2026-09-25T01:00:00.000Z" });
    expect(requestTimeline(declined, "pet").map((event) => event.title)).toEqual(["You sent the request", "Ana Santos declined the request"]);
    // The pet is the default reader.
    expect(requestTimeline(declined)).toEqual(requestTimeline(declined, "pet"));
  });
});

describe("the inbox (RQ-09, RQ-10)", () => {
  it("gives a human the new requests sent to their home, by the pet that sent each", async () => {
    const page = await getInbox(as("human"), "new");
    expect(page.data.map((row) => [row.pet.name, row.status])).toEqual([["Pepper", "sent"]]);
    // Every status is counted, whatever the tab.
    expect(page.counts).toEqual({ sent: 1, meet_scheduled: 1, declined: 1 });
    // The pet is named by its public summary, with the age a row shows.
    expect(page.data[0].pet).toMatchObject({ id: 5, name: "Pepper", species: "dog", status: "looking_for_a_home" });
    expect(typeof page.data[0].pet.approximate_age_months).toBe("number");
  });

  it("gives the ones in progress and the closed ones on their own tabs", async () => {
    expect((await getInbox(as("human"), "in-progress")).data.map((row) => [row.pet.name, row.status])).toEqual([["Mochi", "meet_scheduled"]]);
    expect((await getInbox(as("human"), "closed")).data.map((row) => [row.pet.name, row.status])).toEqual([["Tofu", "declined"]]);
  });

  it("asks the API for its own name of the tab", async () => {
    const { client, calls } = answering({ data: [], meta: { total: 0, current_page: 1, last_page: 1 } });
    await getInbox(client, "new");
    await getInbox(client, "in-progress", 2);
    expect(calls.map((call) => call.query)).toEqual([
      { tab: "new", page: undefined, per_page: 10 },
      { tab: "in_progress", page: 2, per_page: 10 },
    ]);
  });

  it("reads a pet's age strictly", async () => {
    const meta = { total: 1, current_page: 1, last_page: 1 };
    const row = { ...ADOPTION_REQUESTS[2], pet: { ...ADOPTION_REQUESTS[2].pet, approximate_age_months: "old" } };
    expect((await getInbox(answering({ data: [row], meta }).client, "new")).data[0].pet.approximate_age_months).toBeNull();
  });

  it("is closed to admins and to accounts that aren't active", async () => {
    await expect(getInbox(as("admin"), "new")).rejects.toMatchObject({ kind: "forbidden" });
    await expect(getInbox(as("human-pending"), "new")).rejects.toMatchObject({ kind: "account_not_active" });
  });

  it("gives the human a request sent to their home, with the match", async () => {
    expect(await getRequest(as("human"), 3)).toMatchObject({ id: 3, status: "sent", match_score: 64, cooldown_until: null, pet: { name: "Pepper" } });
    // Mochi's request to Paolo is not Ana's to read.
    await expect(getRequest(as("human"), 2)).rejects.toMatchObject({ kind: "not_found" });
  });
});

describe("approving and declining (RQ-12, RQ-13)", () => {
  it("sends only the message, or the reason and the message", async () => {
    const answered = { data: { ...ADOPTION_REQUESTS[2], status: "approved" } };
    const { client, calls } = answering(answered);
    await approveRequest(client, 3, "See you soon!");
    await declineRequest(client, 3, { reason: "not_right_fit", message: null });
    expect(calls).toEqual([
      { method: "POST", path: "/adoption-requests/3/approve", body: { approval_message: "See you soon!" }, query: undefined },
      { method: "POST", path: "/adoption-requests/3/decline", body: { decline_reason: "not_right_fit", decision_message: null }, query: undefined },
    ]);
    // An answer that isn't a request claims nothing.
    await expect(approveRequest(answering({ data: {} }).client, 3, null)).rejects.toMatchObject({ kind: "server" });
  });

  it("lets only the human it was sent to answer, and checks what is sent", async () => {
    // The pet that sent it, and Ana on a request to another home, are answered like a request that doesn't exist.
    await expect(approveRequest(as("pet"), 1, null)).rejects.toMatchObject({ kind: "not_found" });
    await expect(declineRequest(as("pet"), 1, { reason: null, message: null })).rejects.toMatchObject({ kind: "not_found" });
    await expect(approveRequest(as("human"), 2, null)).rejects.toMatchObject({ kind: "not_found" });
    await expect(declineRequest(as("human"), 999, { reason: null, message: null })).rejects.toMatchObject({ kind: "not_found" });

    const long = "a".repeat(ANSWER_MESSAGE_MAX + 1);
    await expect(approveRequest(as("human"), 3, long)).rejects.toMatchObject({ kind: "validation", fieldErrors: { approval_message: expect.any(String) } });
    await expect(declineRequest(as("human"), 3, { reason: "bored" as never, message: long })).rejects.toMatchObject({
      kind: "validation",
      fieldErrors: { decline_reason: expect.any(String), decision_message: expect.any(String) },
    });
  });

  it("refuses to approve a request that is no longer new", async () => {
    // Mochi's is Meet Scheduled, Tofu's was declined.
    await expect(approveRequest(as("human"), 1, null)).rejects.toMatchObject({ kind: "conflict", code: "invalid_request_state" });
    await expect(approveRequest(as("human"), 4, null)).rejects.toMatchObject({ kind: "conflict", code: "invalid_request_state" });
    await expect(declineRequest(as("human"), 4, { reason: null, message: null })).rejects.toMatchObject({ kind: "conflict", code: "invalid_request_state" });
  });

  it("approves a new request, which puts the pet In Process and moves the request to In progress", async () => {
    const human = as("human");
    const approved = await approveRequest(human, 3, "  We'd love to meet Pepper!  ");
    expect(approved).toMatchObject({ id: 3, status: "approved", approval_message: "We'd love to meet Pepper!", pet: { status: "in_process" } });
    expect(approved.approved_at).not.toBeNull();
    // 14 days to book.
    const days = (new Date(approved.expires_at as string).getTime() - new Date(approved.approved_at as string).getTime()) / (24 * 60 * 60 * 1000);
    expect(days).toBe(14);

    expect((await getInbox(human, "new")).data).toEqual([]);
    expect((await getInbox(human, "in-progress")).data.map((row) => row.pet.name).sort()).toEqual(["Mochi", "Pepper"]);
    // It can't be approved twice.
    await expect(approveRequest(human, 3, null)).rejects.toMatchObject({ kind: "conflict", code: "invalid_request_state" });
  });

  it("declines with a reason and a message, which starts the 30-day wait", async () => {
    const human = as("human");
    const declined = await declineRequest(human, 3, { reason: "another_pet_joining", message: " Thank you, Pepper. " });
    expect(declined).toMatchObject({ status: "declined", decline_reason: "another_pet_joining", decision_message: "Thank you, Pepper.", expires_at: null, pet: { status: "looking_for_a_home" } });
    const daysLeft = (new Date(declined.cooldown_until as string).getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(daysLeft).toBeGreaterThan(29.9);
    expect(daysLeft).toBeLessThanOrEqual(30);

    expect((await getInbox(human, "closed")).counts).toEqual({ meet_scheduled: 1, declined: 2 });
    // The pet's own list is unaffected by what a human does with another pet's request.
    expect((await getMyRequests(as("pet"), "active")).meta.total).toBe(2);
  });
});
