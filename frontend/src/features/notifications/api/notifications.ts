import { type ApiClient, apiPath } from "@/lib/api/core";
import { isRecord, isText, readPage, unexpected } from "@/lib/api/readers";
import type { Paginated } from "@/types/api";
import { NOTIFICATION_CATEGORIES, NOTIFICATION_URGENCIES, type Notification, type NotificationCategory } from "@/types/notification";

// Notification calls (docs/api/notifications.md, NT-01…NT-03, FR15, FR31). The list is a read, so it works from
// Server Components with `getServerApi()`; the count and the two writes run in the browser. The API lists only
// the caller's own notifications and answers another account's id like one that doesn't exist (SEC-AUTHZ-04).
// The one path with an id is built with apiPath (SEC-FE-08).

/** Rows on one page of the Notifications screen: the API's own default. */
export const NOTIFICATIONS_PAGE_SIZE = 20;

/** Rows in the Alerts dropdown (NT-01). */
export const LATEST_ALERTS = 4;

const LIST_PROBLEM = "We couldn't load your notifications. Please try again.";
const COUNT_PROBLEM = "We couldn't count your notifications.";

/**
 * A row as the screens read it, or null when it doesn't match the contract and isn't shown. Only the fields a
 * screen reads are kept: `data`, the sender's payload, stays out of what a server page hands to the browser.
 */
function toNotification(row: unknown): Notification | null {
  if (!isRecord(row) || !isText(row.id) || !isText(row.type) || !isText(row.title) || !isText(row.created_at)) return null;
  const category = (NOTIFICATION_CATEGORIES as readonly unknown[]).includes(row.category) ? (row.category as NotificationCategory) : null;
  const urgency = NOTIFICATION_URGENCIES.find((known) => known === row.urgency) ?? "info";
  return {
    id: row.id,
    type: row.type,
    category,
    title: row.title,
    body: isText(row.body) ? row.body : "",
    is_read: row.is_read === true,
    urgency,
    action_url: isText(row.action_url) ? row.action_url : null,
    created_at: row.created_at,
  };
}

type ListOptions = {
  /** The tab's category; leave out for All. */
  category?: NotificationCategory;
  page?: number;
  perPage?: number;
};

/** The account's notifications, newest first (NT-02, NT-03). Dismissed ones are left out by the API. */
export async function getNotifications(client: ApiClient, { category, page = 1, perPage = NOTIFICATIONS_PAGE_SIZE }: ListOptions = {}): Promise<Paginated<Notification>> {
  const query = { category, page: page > 1 ? page : undefined, per_page: perPage };
  const answered = readPage(await client.get<unknown>("/notifications", { query }), isRecord, LIST_PROBLEM);
  return { ...answered, data: answered.data.flatMap((row) => toNotification(row) ?? []) };
}

/**
 * How many are unread, for the count on Alerts. The top bar asks every minute without anyone pressing anything,
 * so a 401 or a "not Active" answer isn't handed to the session's redirect: a background check must not pull the
 * user off a form they are filling in. The next thing they do themselves gets the same answer, and the redirect.
 */
export async function getUnreadCount(client: ApiClient, signal?: AbortSignal): Promise<number> {
  const response = await client.get<unknown>("/notifications/unread-count", { signal, skipAuthRedirect: true });
  const count = isRecord(response) && isRecord(response.data) ? response.data.unread_count : undefined;
  if (typeof count !== "number" || !Number.isInteger(count) || count < 0) throw unexpected(COUNT_PROBLEM);
  return count;
}

/** Marks one notification as read. Marking one that is already read is not an error. */
export async function markNotificationRead(client: ApiClient, notificationId: string): Promise<void> {
  await client.post<unknown>(apiPath`/notifications/${notificationId}/read`);
}

/** Marks every unread notification of the account as read (NT-01, NT-02 "Mark all as read"). */
export async function markAllNotificationsRead(client: ApiClient): Promise<void> {
  await client.post<unknown>("/notifications/read-all");
}
