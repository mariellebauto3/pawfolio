import { ROUTES } from "@/constants/routes";
import type { NotificationCategory } from "@/types/notification";

// The tabs of the Notifications page (NT-02, NT-03). The selected one lives in the URL (`?tab=meet-and-greets`),
// and each is one category of the API's list; All asks for no category.

export const NOTIFICATION_TABS = [
  { id: "all", label: "All" },
  { id: "requests", label: "Requests" },
  { id: "meet-and-greets", label: "Meet & Greets" },
  { id: "account", label: "Account" },
] as const;

export type NotificationTab = (typeof NOTIFICATION_TABS)[number]["id"];

const CATEGORIES: Record<NotificationTab, NotificationCategory | undefined> = {
  all: undefined,
  requests: "requests",
  "meet-and-greets": "meet_and_greets",
  account: "account",
};

/** The tab named in the page's URL. Anything else is All, so a hand-edited address never reaches the API as typed. */
export function notificationTabFromUrl(value: string | string[] | undefined): NotificationTab {
  const text = Array.isArray(value) ? value[0] : value;
  return NOTIFICATION_TABS.find((tab) => tab.id === text)?.id ?? "all";
}

/** What the API is asked for on a tab: `category`, or nothing for All. */
export function categoryForTab(tab: NotificationTab): NotificationCategory | undefined {
  return CATEGORIES[tab];
}

/** The address of a tab and a page of it, leaving out the defaults (All, page 1). */
export function notificationsHref(tab: NotificationTab, page = 1): string {
  const query = new URLSearchParams();
  if (tab !== "all") query.set("tab", tab);
  if (page > 1) query.set("page", String(page));
  const text = query.toString();
  return text ? `${ROUTES.notifications}?${text}` : ROUTES.notifications;
}
