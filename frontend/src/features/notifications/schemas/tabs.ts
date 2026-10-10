import { ROUTES } from "@/constants/routes";
import type { NotificationCategory } from "@/types/notification";
import { type NotificationPeriod, PERIOD_PARAM } from "./history";

// The tabs of the Notifications page (NT-02, NT-03). The selected one lives in the URL (`?tab=meet-and-greets`),
// and each is one category of the API's list; All asks for no category. Announcements (added 2026-10-10, not in
// the LoFi) is a list of its own: what the Pawfolio team published for the account's role, whether or not an alert
// was delivered for it.

/** The tab that lists announcements instead of notifications. */
export const ANNOUNCEMENTS_TAB = "announcements";

export const NOTIFICATION_TABS = [
  { id: "all", label: "All" },
  { id: "requests", label: "Requests" },
  { id: "meet-and-greets", label: "Meet & Greets" },
  { id: "account", label: "Account" },
  { id: ANNOUNCEMENTS_TAB, label: "Announcements" },
] as const;

export type NotificationTab = (typeof NOTIFICATION_TABS)[number]["id"];

const CATEGORIES: Record<NotificationTab, NotificationCategory | undefined> = {
  all: undefined,
  requests: "requests",
  "meet-and-greets": "meet_and_greets",
  account: "account",
  // Not a category of notifications: the page reads the announcements themselves.
  announcements: undefined,
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

/** The address of a tab, a page of it and the period shown, leaving out the defaults (All, page 1, every age). */
export function notificationsHref(tab: NotificationTab, page = 1, period: NotificationPeriod = "all"): string {
  const query = new URLSearchParams();
  if (tab !== "all") query.set("tab", tab);
  // Announcements are a list of their own, with no period.
  if (period !== "all" && tab !== ANNOUNCEMENTS_TAB) query.set(PERIOD_PARAM, period);
  if (page > 1) query.set("page", String(page));
  const text = query.toString();
  return text ? `${ROUTES.notifications}?${text}` : ROUTES.notifications;
}
