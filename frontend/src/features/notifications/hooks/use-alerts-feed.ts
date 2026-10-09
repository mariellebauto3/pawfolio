"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { api } from "@/lib/api/client";
import type { Alerts } from "@/providers/alerts-provider";
import { useSession } from "@/providers/session-provider";
import { EMPTY_ALERTS, createAlertsStore } from "./alerts-store";

const noSubscription = () => () => {};
const emptySnapshot = () => EMPTY_ALERTS;

/**
 * The signed-in account's notifications for the top bar and the Notifications page: the unread count, kept current
 * by asking every minute and when the window is looked at again (no websockets), and the latest few. Null for
 * anyone who isn't signed in and Active: the API would refuse them (SEC-AUTHZ-06), so nothing is asked.
 */
export function useAlertsFeed(): Alerts | null {
  const router = useRouter();
  const { status, isActive, account } = useSession();
  const accountId = status === "signed-in" && isActive && account ? account.id : null;

  // One store per account: signing in as someone else starts from nothing.
  const store = useMemo(() => (accountId === null ? null : createAlertsStore(api, { isHidden: () => document.hidden })), [accountId]);
  const snapshot = useSyncExternalStore(store?.subscribe ?? noSubscription, store?.getSnapshot ?? emptySnapshot, emptySnapshot);

  useEffect(() => {
    if (!store) return;
    store.start();
    window.addEventListener("focus", store.poke);
    document.addEventListener("visibilitychange", store.poke);
    return () => {
      store.stop();
      window.removeEventListener("focus", store.poke);
      document.removeEventListener("visibilitychange", store.poke);
    };
  }, [store]);

  return useMemo(() => {
    if (!store) return null;
    return {
      unreadCount: snapshot.unreadCount,
      latest: snapshot.latest,
      loadLatest: () => void store.loadLatest(),
      isUnread: ({ id, is_read }) => !is_read && !snapshot.readIds.has(id),
      markRead: ({ id }) => store.markRead(id),
      async markAllRead() {
        await store.markAllRead();
        // Whatever page is open may be listing notifications (NT-02): have the server render it again, and drop
        // the pages kept for Back, which would show them unread.
        router.refresh();
      },
    };
  }, [store, snapshot, router]);
}
