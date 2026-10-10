import { formatMonthYear, philippineToday } from "@/lib/utils/format-date";

// The Notifications page as a history (NT-02, NT-03, added 2026-10-10). Nothing is removed for being old: every
// notification an account ever got stays listed, newest first. These are the rules for cutting that list into
// sections by age, and for the "Earlier" view that goes straight to what is older than a week. The API sorts and
// filters (docs/api/notifications.md, `period`); the headings are worked out here from each row's date.

/** How many days a notification counts as recent. The API's own number (`Notification::RECENT_DAYS`). */
export const RECENT_DAYS = 7;

export const NOTIFICATION_PERIODS = [
  { id: "all", label: "All" },
  { id: "recent", label: "Last 7 days" },
  { id: "earlier", label: "Earlier" },
] as const;

export type NotificationPeriod = (typeof NOTIFICATION_PERIODS)[number]["id"];

/** The period named in the page's URL (`?when=earlier`). Anything else is All, so a hand-edited address never reaches the API as typed. */
export function notificationPeriodFromUrl(value: string | string[] | undefined): NotificationPeriod {
  const text = Array.isArray(value) ? value[0] : value;
  return NOTIFICATION_PERIODS.find((period) => period.id === text)?.id ?? "all";
}

/** The query parameter that holds the period. */
export const PERIOD_PARAM = "when";

export type AgeGroup<T> = {
  /** Unique on a page: `today`, `yesterday`, `week`, `month`, or a month such as `2026-09`. */
  id: string;
  /** "Today", "Yesterday", "This week", "Earlier this month", "September 2026". */
  heading: string;
  rows: T[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** A Philippine calendar day ("2026-10-08") as a number of whole days, to count the days between two of them. */
const dayNumber = (day: string) => Math.round(Date.parse(`${day}T00:00:00Z`) / DAY_MS);

/**
 * Rows, newest first as the API sends them, under the heading their age gives them. Days are Philippine days, as
 * every date on the page is: today, yesterday, the rest of the last 7 days (the same 7 days the API calls recent),
 * the rest of this month, and then one section per month, however far back. A row whose date can't be read stays with the rows before it.
 */
export function groupByAge<T>(rows: readonly T[], createdAt: (row: T) => string, now: Date = new Date()): AgeGroup<T>[] {
  const today = philippineToday(now);
  const groups: AgeGroup<T>[] = [];

  for (const row of rows) {
    const at = new Date(createdAt(row));
    let group: Pick<AgeGroup<T>, "id" | "heading"> | null = null;

    if (!Number.isNaN(at.getTime())) {
      const day = philippineToday(at);
      const age = dayNumber(today) - dayNumber(day);
      if (age <= 0) group = { id: "today", heading: "Today" };
      else if (age === 1) group = { id: "yesterday", heading: "Yesterday" };
      // The API's own line between recent and earlier: 7 days to the minute, not 7 calendar days.
      else if (now.getTime() - at.getTime() < RECENT_DAYS * DAY_MS) group = { id: "week", heading: "This week" };
      else if (day.slice(0, 7) === today.slice(0, 7)) group = { id: "month", heading: "Earlier this month" };
      else group = { id: day.slice(0, 7), heading: formatMonthYear(at.toISOString()) };
    }

    const last = groups[groups.length - 1];
    if (last && (group === null || last.id === group.id)) last.rows.push(row);
    else groups.push({ ...(group ?? { id: "undated", heading: "Earlier" }), rows: [row] });
  }

  return groups;
}

/** "1 notification", "8 notifications", or "Showing 21 to 40 of 134 notifications" when they don't fit one page. */
export function notificationCount({ total, from, to }: { total: number; from: number | null; to: number | null }): string {
  const noun = total === 1 ? "notification" : "notifications";
  if (from !== null && to !== null && to - from + 1 < total) return `Showing ${from} to ${to} of ${total} ${noun}`;
  return `${total} ${noun}`;
}
