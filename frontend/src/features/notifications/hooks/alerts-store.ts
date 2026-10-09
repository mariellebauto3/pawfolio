import type { ApiClient } from "@/lib/api/core";
import { isApiError } from "@/lib/api/errors";
import type { AlertsLatest } from "@/providers/alerts-provider";
import { LATEST_ALERTS, getNotifications, getUnreadCount, markAllNotificationsRead, markNotificationRead } from "../api/notifications";

// What the top bar knows about the account's notifications, and how it stays current without websockets: the
// unread count is asked for when the store starts, every minute while the tab is visible, and when the window is
// looked at again. Kept free of React and of the DOM so every rule here is covered by a unit test; the hook
// (`use-alerts-feed.ts`) only connects it to the page.

export const POLL_INTERVAL_MS = 60_000;

/** Focus and visibility events arrive in pairs, and tabs get flicked through: one check per this long is enough. */
export const MIN_CHECK_GAP_MS = 10_000;

export type AlertsSnapshot = {
  unreadCount: number | undefined;
  latest: AlertsLatest;
  /** Notifications opened here since their list was loaded: a page that is shown again still has them unread. */
  readIds: ReadonlySet<string>;
};

export const EMPTY_ALERTS: AlertsSnapshot = { unreadCount: undefined, latest: { status: "idle", items: [] }, readIds: new Set() };

type Options = {
  intervalMs?: number;
  minGapMs?: number;
  /** Whether the tab is in the background: nothing is asked while nobody can see the answer. */
  isHidden?: () => boolean;
  now?: () => number;
};

export type AlertsStore = ReturnType<typeof createAlertsStore>;

export function createAlertsStore(client: ApiClient, { intervalMs = POLL_INTERVAL_MS, minGapMs = MIN_CHECK_GAP_MS, isHidden = () => false, now = Date.now }: Options = {}) {
  let snapshot = EMPTY_ALERTS;
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setInterval> | null = null;
  let running = false;
  let lastCheckAt = Number.NEGATIVE_INFINITY;
  // An answer is used only if nothing overtook it: a newer question, or a write that changed what it counted.
  let countTurn = 0;
  let latestTurn = 0;

  function set(change: Partial<AlertsSnapshot>) {
    snapshot = { ...snapshot, ...change };
    listeners.forEach((listener) => listener());
  }

  /** Asks the API for the count. `reloadRows`: also load the dropdown's rows again when the count has moved. */
  async function check(reloadRows = true): Promise<void> {
    if (!running) return;
    const turn = ++countTurn;
    lastCheckAt = now();
    try {
      const unreadCount = await getUnreadCount(client);
      if (!running || turn !== countTurn) return;
      const changed = snapshot.unreadCount !== undefined && snapshot.unreadCount !== unreadCount;
      set({ unreadCount });
      // Something arrived, or was read on another device: the dropdown's rows are out of date too.
      if (reloadRows && changed && snapshot.latest.status !== "idle") void loadLatest();
    } catch (error) {
      if (!isApiError(error)) throw error;
      // Signed out or no longer Active: asking again can't succeed. Stop; the user's next step shows them why.
      if (error.kind === "unauthenticated" || error.kind === "account_not_active") stop();
      // Anything else (offline, a busy server) keeps the last count, and the next check tries again.
    }
  }

  function start(): void {
    if (running) return;
    running = true;
    void check();
    timer = setInterval(() => {
      if (!isHidden()) void check();
    }, intervalMs);
  }

  function stop(): void {
    running = false;
    if (timer !== null) clearInterval(timer);
    timer = null;
  }

  /** The window has focus again, or the tab came back: check now, unless a check has just been made. */
  function poke(): void {
    if (!running || isHidden() || now() - lastCheckAt < minGapMs) return;
    void check();
  }

  async function loadLatest(): Promise<void> {
    const turn = ++latestTurn;
    // What was loaded before stays on show while the newer answer is on its way.
    if (snapshot.latest.status !== "ready") set({ latest: { status: "loading", items: snapshot.latest.items } });
    try {
      const page = await getNotifications(client, { perPage: LATEST_ALERTS });
      if (turn !== latestTurn) return;
      set({ latest: { status: "ready", items: page.data } });
      // The rows are as new as can be: have the count say the same, without waiting for its minute.
      void check(false);
    } catch (error) {
      if (!isApiError(error)) throw error;
      if (turn !== latestTurn) return;
      const { items } = snapshot.latest;
      set({ latest: { status: items.length > 0 ? "ready" : "error", items } });
    }
  }

  /** One notification was opened. The count drops at once; if the API refuses, both are put back. */
  function markRead(notificationId: string): void {
    if (snapshot.readIds.has(notificationId)) return;
    countTurn += 1;
    const { unreadCount } = snapshot;
    set({
      readIds: new Set(snapshot.readIds).add(notificationId),
      unreadCount: unreadCount === undefined ? undefined : Math.max(unreadCount - 1, 0),
    });

    void markNotificationRead(client, notificationId)
      .catch((error: unknown) => {
        if (!isApiError(error)) throw error;
        const readIds = new Set(snapshot.readIds);
        readIds.delete(notificationId);
        set({ readIds });
      })
      .then(() => check());
  }

  /** Everything is read. Shown at once; if the API refuses, what was shown before is put back and the error is the caller's to show. */
  async function markAllRead(): Promise<void> {
    const before = snapshot;
    countTurn += 1;
    latestTurn += 1;
    const { latest } = snapshot;
    set({ unreadCount: 0, latest: { ...latest, items: latest.items.map((item) => ({ ...item, is_read: true })) } });

    try {
      await markAllNotificationsRead(client);
    } catch (error) {
      set({ unreadCount: before.unreadCount, latest: before.latest });
      throw error;
    } finally {
      // Either way, ask the API where things stand: the count, and the rows if the dropdown has been opened (a
      // load that was overtaken just now will never answer).
      void check();
      if (snapshot.latest.status !== "idle") void loadLatest();
    }
  }

  return {
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => snapshot,
    start,
    stop,
    poke,
    loadLatest,
    markRead,
    markAllRead,
  };
}
