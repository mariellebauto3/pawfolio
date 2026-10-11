import type { IsoDateTime } from "@/types/api";

// A notification as the API sends it (docs/api/notifications.md, NotificationResource). The API also sends `data`,
// `is_dismissed` and `sender`; no screen reads them, so the reader leaves them out (features/notifications/api).

/** The tab a notification is listed under (NT-02, NT-03). Feed activity has no tab and is read under All. */
export const NOTIFICATION_CATEGORIES = ["requests", "meet_and_greets", "account", "feed"] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

/** `warning` and `urgent` mean someone must act: a decision is due, a meeting is an hour away. */
export const NOTIFICATION_URGENCIES = ["info", "warning", "urgent"] as const;
export type NotificationUrgency = (typeof NOTIFICATION_URGENCIES)[number];

export type Notification = {
  /** A ULID such as "01K7…", not a number. */
  id: string;
  /** What happened, e.g. `invite_sent`, `request_approved`, `announcement`. */
  type: string;
  category: NotificationCategory | null;
  title: string;
  body: string;
  is_read: boolean;
  urgency: NotificationUrgency;
  /** Where it leads, as the API wrote it. Never follow it as it is: `notificationHref` checks it first (SEC-FE-07). */
  action_url: string | null;
  created_at: IsoDateTime;
};
