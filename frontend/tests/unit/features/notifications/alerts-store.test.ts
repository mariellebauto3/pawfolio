import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MIN_CHECK_GAP_MS, POLL_INTERVAL_MS, createAlertsStore } from "@/features/notifications/hooks/alerts-store";
import { type Transport, createApiClient } from "@/lib/api/core";

// The store behind the Alerts tab (NT-01): when it asks the API, and what it shows while a write is on its way.
// The API here is a small stand-in that counts what it is asked and can be told to fail or to wait.

type Row = { id: string; type: string; category: string; title: string; body: string; is_read: boolean; urgency: string; action_url: string | null; created_at: string };

const row = (id: string, is_read = false): Row => ({ id, type: "request_received", category: "requests", title: `Notification ${id}`, body: "", is_read, urgency: "info", action_url: "/requests/1", created_at: "2026-10-09T02:00:00+00:00" });

function fakeApi(initial: Row[]) {
  const state = { rows: initial, failWith: null as number | null, hold: null as Promise<void> | null };
  const asked: string[] = [];
  const transport: Transport = async ({ method, path }) => {
    asked.push(`${method} ${path}`);
    if (state.hold) await state.hold;
    if (state.failWith !== null) return { status: state.failWith, body: { message: "Refused." }, retryAfter: null };
    if (path === "/notifications/unread-count") return { status: 200, body: { data: { unread_count: state.rows.filter((r) => !r.is_read).length } }, retryAfter: null };
    if (path === "/notifications/read-all") state.rows = state.rows.map((r) => ({ ...r, is_read: true }));
    else if (path.endsWith("/read")) state.rows = state.rows.map((r) => (path === `/notifications/${r.id}/read` ? { ...r, is_read: true } : r));
    else if (path === "/notifications") return { status: 200, body: { data: state.rows.slice(0, 4), meta: { total: state.rows.length, current_page: 1, last_page: 1 } }, retryAfter: null };
    return { status: 200, body: { data: {} }, retryAfter: null };
  };
  const counts = () => asked.filter((call) => call === "GET /notifications/unread-count").length;
  const lists = () => asked.filter((call) => call === "GET /notifications").length;
  return { client: createApiClient(transport), state, asked, counts, lists };
}

/** Lets every answer that is already on its way arrive. */
const settle = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("keeping the unread count current", () => {
  it("counts when it starts, then every minute", async () => {
    const api = fakeApi([row("a"), row("b"), row("c", true)]);
    const store = createAlertsStore(api.client);
    expect(store.getSnapshot().unreadCount).toBeUndefined();

    store.start();
    await settle();
    expect(store.getSnapshot().unreadCount).toBe(2);
    expect(api.counts()).toBe(1);

    api.state.rows = [row("d"), ...api.state.rows];
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS - 1);
    expect(api.counts()).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(store.getSnapshot().unreadCount).toBe(3);

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3);
    expect(api.counts()).toBe(5);
    store.stop();
  });

  it("asks nothing while the tab is in the background, and catches up when it is looked at again", async () => {
    const api = fakeApi([row("a")]);
    let hidden = false;
    const store = createAlertsStore(api.client, { isHidden: () => hidden });
    store.start();
    await settle();

    hidden = true;
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 5);
    store.poke();
    expect(api.counts()).toBe(1);

    api.state.rows = [row("b"), row("a")];
    hidden = false;
    store.poke();
    await settle();
    expect(api.counts()).toBe(2);
    expect(store.getSnapshot().unreadCount).toBe(2);
    store.stop();
  });

  it("checks once when focus and visibility arrive together, and again only after a pause", async () => {
    const api = fakeApi([row("a")]);
    const store = createAlertsStore(api.client);
    store.start();
    await settle();

    store.poke();
    store.poke();
    expect(api.counts()).toBe(1);

    await vi.advanceTimersByTimeAsync(MIN_CHECK_GAP_MS);
    store.poke();
    store.poke();
    await settle();
    expect(api.counts()).toBe(2);
    store.stop();
  });

  it("stops when it is stopped, and tells whoever listens only while they listen", async () => {
    const api = fakeApi([row("a")]);
    const store = createAlertsStore(api.client);
    const heard = vi.fn();
    const unsubscribe = store.subscribe(heard);
    store.start();
    await settle();
    expect(heard).toHaveBeenCalledTimes(1);

    unsubscribe();
    store.stop();
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3);
    store.poke();
    expect(api.counts()).toBe(1);
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it("keeps the last count through an outage and tries again", async () => {
    const api = fakeApi([row("a"), row("b")]);
    const store = createAlertsStore(api.client);
    store.start();
    await settle();

    api.state.failWith = 503;
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    expect(store.getSnapshot().unreadCount).toBe(2);

    api.state.failWith = null;
    api.state.rows = [];
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    expect(store.getSnapshot().unreadCount).toBe(0);
    store.stop();
  });

  it("stops asking once the session is over or the account isn't Active", async () => {
    const refusals = [
      { status: 401, body: { message: "Unauthenticated." } },
      { status: 403, body: { message: "Your account isn't active.", code: "account_not_active" } },
    ];
    for (const refusal of refusals) {
      let asked = 0;
      let refuse = false;
      const transport: Transport = async () => {
        asked += 1;
        return refuse ? { ...refusal, retryAfter: null } : { status: 200, body: { data: { unread_count: 1 } }, retryAfter: null };
      };
      const store = createAlertsStore(createApiClient(transport));
      store.start();
      await settle();

      refuse = true;
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
      expect(asked).toBe(2);
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3);
      store.poke();
      expect(asked).toBe(2);
      expect(store.getSnapshot().unreadCount).toBe(1);
    }
  });
});

describe("the latest few, for the dropdown", () => {
  it("loads four, shows what it had while it asks again, and is asked for again when the count changes", async () => {
    const api = fakeApi([row("a"), row("b"), row("c"), row("d"), row("e")]);
    const store = createAlertsStore(api.client);
    store.start();
    await settle();
    expect(store.getSnapshot().latest).toEqual({ status: "idle", items: [] });
    expect(api.lists()).toBe(0);

    const first = store.loadLatest();
    expect(store.getSnapshot().latest.status).toBe("loading");
    await first;
    expect(store.getSnapshot().latest.status).toBe("ready");
    expect(store.getSnapshot().latest.items.map((item) => item.id)).toEqual(["a", "b", "c", "d"]);

    // Opened again: the rows stay on show.
    const second = store.loadLatest();
    expect(store.getSnapshot().latest.status).toBe("ready");
    await second;

    // A new one arrives; the next count notices, and the rows follow without being asked for.
    api.state.rows = [row("new"), ...api.state.rows];
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    expect(store.getSnapshot().unreadCount).toBe(6);
    expect(store.getSnapshot().latest.items[0].id).toBe("new");
    expect(api.lists()).toBe(3);
    store.stop();
  });

  it("counts again as it loads, so the count and the rows agree, and loads the rows once", async () => {
    const api = fakeApi([row("a")]);
    const store = createAlertsStore(api.client);
    store.start();
    await settle();

    // Two arrive between two checks; the dropdown is opened before the next one.
    api.state.rows = [row("c"), row("b"), row("a")];
    await store.loadLatest();
    await settle();
    expect(store.getSnapshot().latest.items.map((item) => item.id)).toEqual(["c", "b", "a"]);
    expect(store.getSnapshot().unreadCount).toBe(3);
    expect(api.lists()).toBe(1);
    expect(api.counts()).toBe(2);
    store.stop();
  });

  it("says it failed when there is nothing to show, and keeps what it had otherwise", async () => {
    const api = fakeApi([row("a")]);
    const store = createAlertsStore(api.client);

    api.state.failWith = 500;
    await store.loadLatest();
    expect(store.getSnapshot().latest).toEqual({ status: "error", items: [] });

    api.state.failWith = null;
    await store.loadLatest();
    api.state.failWith = 500;
    await store.loadLatest();
    expect(store.getSnapshot().latest.status).toBe("ready");
    expect(store.getSnapshot().latest.items.map((item) => item.id)).toEqual(["a"]);
  });

  it("uses the newest answer when two are on their way", async () => {
    const api = fakeApi([row("old")]);
    const store = createAlertsStore(api.client);
    let release = () => {};
    api.state.hold = new Promise<void>((resolve) => (release = resolve));
    const slow = store.loadLatest();

    api.state.hold = null;
    api.state.rows = [row("new")];
    await store.loadLatest();
    api.state.rows = [row("old")];
    release();
    await slow;
    expect(store.getSnapshot().latest.items.map((item) => item.id)).toEqual(["new"]);
  });
});

describe("opening one", () => {
  it("drops the count at once, tells the API, and remembers the row as read", async () => {
    const api = fakeApi([row("a"), row("b")]);
    const store = createAlertsStore(api.client);
    store.start();
    await settle();

    store.markRead("a");
    expect(store.getSnapshot().unreadCount).toBe(1);
    expect(store.getSnapshot().readIds.has("a")).toBe(true);
    // Pressed twice: counted once.
    store.markRead("a");
    expect(store.getSnapshot().unreadCount).toBe(1);

    await settle();
    expect(api.asked.filter((call) => call === "POST /notifications/a/read")).toHaveLength(1);
    expect(store.getSnapshot().unreadCount).toBe(1);
    store.stop();
  });

  it("ignores a count that was taken before the row was opened", async () => {
    const api = fakeApi([row("a"), row("b")]);
    const store = createAlertsStore(api.client);
    store.start();
    await settle();

    // A check leaves and is still on its way when the row is opened: the "2" it brings back is out of date.
    let release = () => {};
    api.state.hold = new Promise<void>((resolve) => (release = resolve));
    vi.advanceTimersByTime(POLL_INTERVAL_MS);
    store.markRead("a");
    const seen: Array<number | undefined> = [];
    store.subscribe(() => seen.push(store.getSnapshot().unreadCount));

    api.state.hold = null;
    release();
    await settle();
    expect(seen).not.toContain(2);
    expect(store.getSnapshot().unreadCount).toBe(1);
    store.stop();
  });

  it("puts the row and the count back when the API refuses", async () => {
    const refuseWrites: Transport = async ({ method }) =>
      method === "POST" ? { status: 500, body: { message: "Refused." }, retryAfter: null } : { status: 200, body: { data: { unread_count: 2 } }, retryAfter: null };
    const store = createAlertsStore(createApiClient(refuseWrites));
    store.start();
    await settle();

    store.markRead("a");
    expect(store.getSnapshot().unreadCount).toBe(1);
    await settle();
    expect(store.getSnapshot().readIds.has("a")).toBe(false);
    expect(store.getSnapshot().unreadCount).toBe(2);
    store.stop();
  });
});

describe("Mark all as read", () => {
  it("shows everything as read at once, then agrees with the API", async () => {
    const api = fakeApi([row("a"), row("b"), row("c", true)]);
    const store = createAlertsStore(api.client);
    store.start();
    await store.loadLatest();

    const marking = store.markAllRead();
    expect(store.getSnapshot().unreadCount).toBe(0);
    expect(store.getSnapshot().latest.items.every((item) => item.is_read)).toBe(true);

    await marking;
    await settle();
    expect(api.asked).toContain("POST /notifications/read-all");
    expect(store.getSnapshot().unreadCount).toBe(0);
    expect(store.getSnapshot().latest.items.every((item) => item.is_read)).toBe(true);
    store.stop();
  });

  it("puts everything back and passes the error on when the API refuses", async () => {
    const api = fakeApi([row("a"), row("b")]);
    const store = createAlertsStore(api.client);
    store.start();
    await store.loadLatest();

    api.state.failWith = 500;
    await expect(store.markAllRead()).rejects.toMatchObject({ kind: "server" });
    expect(store.getSnapshot().unreadCount).toBe(2);
    expect(store.getSnapshot().latest.items.map((item) => item.is_read)).toEqual([false, false]);
    store.stop();
  });

  it("doesn't load the dropdown's rows when it was never opened", async () => {
    const api = fakeApi([row("a")]);
    const store = createAlertsStore(api.client);
    store.start();
    await settle();
    await store.markAllRead();
    await settle();
    expect(api.lists()).toBe(0);
    expect(store.getSnapshot().latest.status).toBe("idle");
    store.stop();
  });
});
