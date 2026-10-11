"use client";

import { type ReactNode, createContext, useContext } from "react";
import type { Notification } from "@/types/notification";

/** The latest few notifications, as the Alerts dropdown shows them (NT-01). */
export type AlertsLatest = {
  /** `idle`: not asked for yet. `error`: the API couldn't say, and there is nothing older to show. */
  status: "idle" | "loading" | "ready" | "error";
  items: Notification[];
};

export type Alerts = {
  /** How many notifications are unread, as the API last counted them; undefined until it has answered. */
  unreadCount: number | undefined;
  latest: AlertsLatest;
  /** Loads the latest few again. The dropdown calls it each time it opens. */
  loadLatest: () => void;
  /** Whether a row still reads as unread, counting what was opened since the list it is on was loaded. */
  isUnread: (notification: Pick<Notification, "id" | "is_read">) => boolean;
  /** Marks one as read as it is opened. The count drops at once; the API is told in the background. */
  markRead: (notification: Pick<Notification, "id">) => void;
  /** Marks every notification as read. Rejects with the `ApiError` when the API refuses, and puts the count back. */
  markAllRead: () => Promise<void>;
};

const AlertsContext = createContext<Alerts | null>(null);

// What the top bar and the Notifications page know about the account's notifications. This file is only the
// contract: the notifications feature fills it (`AlertsFeed`, mounted by the member layout), so shared navigation
// never imports a feature (frontend-guidelines §2).
export function AlertsProvider({ value, children }: { value: Alerts | null; children: ReactNode }) {
  return <AlertsContext.Provider value={value}>{children}</AlertsContext.Provider>;
}

/** Null where nothing feeds it: a signed-out or non-Active account, or a page outside the member layout. */
export function useAlerts(): Alerts | null {
  return useContext(AlertsContext);
}
