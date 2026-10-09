import { describe, expect, it } from "vitest";
import { LATEST_ALERTS, getNotifications, getUnreadCount, markAllNotificationsRead, markNotificationRead } from "@/features/notifications/api/notifications";
import { type ApiErrorListener, type Transport, createApiClient } from "@/lib/api/core";
import { MOCK_PERSONA_COOKIE, createMockTransport } from "@/lib/api/mock/transport";

// The notification calls against the mock API, which answers in the shapes of docs/api/notifications.md. The mock
// keeps what is read in memory for the whole file, so the tests that change it come last.
function as(persona: string, onError?: ApiErrorListener) {
  return createApiClient(createMockTransport({ readCookie: (name) => (name === MOCK_PERSONA_COOKIE ? persona : null), writePersona: () => {}, latencyMs: 0 }), { onError });
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

const META = { total: 1, current_page: 1, last_page: 1 };
const ROW = { id: "01K7A", type: "invite_sent", category: "requests", title: "Ana invited you to apply!", body: "Hello", is_read: false, urgency: "info", action_url: "/invites", created_at: "2026-10-09T02:00:00+00:00" };

describe("the Notifications list (NT-02, NT-03)", () => {
  it("gives a pet its own notifications, newest first, unread ones marked", async () => {
    const page = await getNotifications(as("pet"));
    expect(page.data.map((row) => row.title).slice(0, 3)).toEqual(["Paolo Garcia invited you to apply!", "Meet & Greet confirmed", "Meet & Greet reminder (tomorrow)"]);
    expect(page.data.map((row) => row.is_read).slice(0, 3)).toEqual([false, false, true]);
    expect(page.data[0]).toMatchObject({ category: "requests", action_url: "/invites", urgency: "info" });
    expect(page.meta.total).toBe(7);
  });

  it("gives a human theirs, not the pet's", async () => {
    const page = await getNotifications(as("human"));
    expect(page.data[0]).toMatchObject({ title: "Decision needed for Siopao", category: "meet_and_greets", urgency: "warning", action_url: "/requests/7" });
    expect(page.data.some((row) => row.title.includes("invited you"))).toBe(false);
    // An admin has an account and no notifications yet.
    expect((await getNotifications(as("admin"))).meta.total).toBe(0);
  });

  it("lists one tab's category", async () => {
    const titles = async (category: "requests" | "meet_and_greets" | "account") => (await getNotifications(as("human"), { category })).data.map((row) => row.title);
    expect(await titles("requests")).toEqual(["New adoption request", "Luna has been adopted"]);
    // The decision reminder is a Meet & Greet notification, whatever its type says.
    expect(await titles("meet_and_greets")).toEqual(["Decision needed for Siopao", "Meet & Greet reminder (tomorrow)", "Mochi booked a Meet & Greet"]);
    expect(await titles("account")).toEqual(["Pawfolio Adoption Week starts Oct 10!"]);
  });

  it("asks for a page of twenty, for page 1 without naming it, and for four in the dropdown", async () => {
    const { client, calls } = answering({ data: [], meta: META });
    await getNotifications(client);
    await getNotifications(client, { category: "account", page: 3 });
    await getNotifications(client, { perPage: LATEST_ALERTS });
    expect(calls.map((call) => call.query)).toEqual([
      { category: undefined, page: undefined, per_page: 20 },
      { category: "account", page: 3, per_page: 20 },
      { category: undefined, page: undefined, per_page: 4 },
    ]);
    expect(calls.every((call) => call.method === "GET" && call.path === "/notifications")).toBe(true);
  });

  it("refuses an answer that isn't a page, and leaves out rows that don't match the contract", async () => {
    await expect(getNotifications(answering({ data: "nope" }).client)).rejects.toMatchObject({ kind: "server" });

    const rows = [ROW, { ...ROW, id: 12 }, { ...ROW, title: undefined }, null, "row"];
    expect((await getNotifications(answering({ data: rows, meta: META }).client)).data.map((row) => row.id)).toEqual(["01K7A"]);
  });

  it("keeps only what the screens read, with safe defaults for what it doesn't know", async () => {
    const sent = { ...ROW, category: "Meet & Greets", urgency: "critical", is_read: "yes", action_url: 7, body: null, data: { reason: "private" }, sender: "Mochi", is_dismissed: false };
    const [row] = (await getNotifications(answering({ data: [sent], meta: META }).client)).data;
    expect(row).toEqual({ id: "01K7A", type: "invite_sent", category: null, title: ROW.title, body: "", is_read: false, urgency: "info", action_url: null, created_at: ROW.created_at });
  });

  it("is closed to accounts that aren't active and to visitors", async () => {
    await expect(getNotifications(as("pet-suspended"))).rejects.toMatchObject({ kind: "account_not_active" });
    await expect(getNotifications(as("signed-out"))).rejects.toMatchObject({ kind: "unauthenticated" });
  });
});

describe("the unread count on Alerts (NT-01)", () => {
  it("counts the account's unread notifications", async () => {
    expect(await getUnreadCount(as("pet"))).toBe(2);
    expect(await getUnreadCount(as("human"))).toBe(2);
    expect(await getUnreadCount(as("admin"))).toBe(0);
  });

  it("asks the API's own endpoint, and refuses an answer that isn't a count", async () => {
    const { client, calls } = answering({ data: { unread_count: 5 } });
    expect(await getUnreadCount(client)).toBe(5);
    expect(calls).toEqual([{ method: "GET", path: "/notifications/unread-count", body: undefined, query: undefined }]);

    for (const body of [{ data: {} }, { data: { unread_count: "5" } }, { data: { unread_count: -1 } }, { data: { unread_count: 1.5 } }, null]) {
      await expect(getUnreadCount(answering(body).client)).rejects.toMatchObject({ kind: "server" });
    }
  });

  it("doesn't hand a signed-out answer to the session's redirect: nobody pressed anything", async () => {
    const reported: string[] = [];
    await expect(getUnreadCount(as("signed-out", (error) => reported.push(error.kind)))).rejects.toMatchObject({ kind: "unauthenticated" });
    await expect(getUnreadCount(as("pet-suspended", (error) => reported.push(error.kind)))).rejects.toMatchObject({ kind: "account_not_active" });
    expect(reported).toEqual([]);
    // The list is something the user opened, so it does.
    await expect(getNotifications(as("signed-out", (error) => reported.push(error.kind)))).rejects.toMatchObject({ kind: "unauthenticated" });
    expect(reported).toEqual(["unauthenticated"]);
  });
});

describe("marking as read", () => {
  it("sends each to its own endpoint, with the id encoded into the path", async () => {
    const { client, calls } = answering({ data: {} });
    await markNotificationRead(client, "01K7A");
    await markNotificationRead(client, "../../admin/accounts/5/suspend");
    await markAllNotificationsRead(client);
    expect(calls.map(({ method, path }) => ({ method, path }))).toEqual([
      { method: "POST", path: "/notifications/01K7A/read" },
      { method: "POST", path: "/notifications/..%2F..%2Fadmin%2Faccounts%2F5%2Fsuspend/read" },
      { method: "POST", path: "/notifications/read-all" },
    ]);
  });

  it("marks one as read, once, and only the account's own", async () => {
    const pet = as("pet");
    const [first] = (await getNotifications(pet)).data;
    await markNotificationRead(pet, first.id);
    await markNotificationRead(pet, first.id);
    expect(await getUnreadCount(pet)).toBe(1);
    expect((await getNotifications(pet)).data[0].is_read).toBe(true);

    // Another account's notification answers like one that doesn't exist, and stays unread.
    const [theirs] = (await getNotifications(as("human"))).data;
    await expect(markNotificationRead(pet, theirs.id)).rejects.toMatchObject({ kind: "not_found" });
    expect(await getUnreadCount(as("human"))).toBe(2);
  });

  it("marks all of the account's as read, and nobody else's", async () => {
    const human = as("human");
    await markAllNotificationsRead(human);
    expect(await getUnreadCount(human)).toBe(0);
    expect((await getNotifications(human)).data.every((row) => row.is_read)).toBe(true);
    expect(await getUnreadCount(as("pet"))).toBe(1);
  });
});
