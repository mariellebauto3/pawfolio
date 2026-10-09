// Dates from the API are UTC. Pawfolio is used in the Philippines, so they are shown in Philippine time wherever the
// page is rendered, on the server or in the browser, and both write the same text.

const TIME_ZONE = "Asia/Manila";

const DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: TIME_ZONE });
const TIME = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: TIME_ZONE });

function parse(iso: string): Date | null {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "Sep 13, 2026"; empty when the value isn't a date. */
export function formatDate(iso: string): string {
  const date = parse(iso);
  return date ? DATE.format(date) : "";
}

/** "Sep 13, 2026, 2:48 PM"; empty when the value isn't a date. */
export function formatDateTime(iso: string): string {
  const date = parse(iso);
  // Newer ICU data puts a narrow no-break space before AM/PM; a plain space reads the same and matches everywhere.
  return date ? `${DATE.format(date)}, ${TIME.format(date).replace(/ /g, " ")}` : "";
}

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;

/**
 * How long ago something happened, as a list of notifications writes it (NT-01…NT-03): "Just now", "5m ago",
 * "2h ago", "3d ago", "2w ago", and the date once it is more than four weeks old. Empty when the value isn't a date.
 */
export function formatTimeAgo(iso: string, now: Date = new Date()): string {
  const date = parse(iso);
  if (!date) return "";
  // A moment "in the future" is a clock that runs behind the server's: it just happened.
  const elapsed = Math.max(now.getTime() - date.getTime(), 0);
  if (elapsed < MINUTE_MS) return "Just now";
  if (elapsed < HOUR_MS) return `${Math.floor(elapsed / MINUTE_MS)}m ago`;
  if (elapsed < DAY_MS) return `${Math.floor(elapsed / HOUR_MS)}h ago`;
  if (elapsed < WEEK_MS) return `${Math.floor(elapsed / DAY_MS)}d ago`;
  if (elapsed < 5 * WEEK_MS) return `${Math.floor(elapsed / WEEK_MS)}w ago`;
  return DATE.format(date);
}

const WEEKDAY = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: TIME_ZONE });
const MONTH = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: TIME_ZONE });
const DAY = new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone: TIME_ZONE });
const INPUT_DATE = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: TIME_ZONE });

/** A day and a time someone plans around, in pieces: "Sat", "Oct", "10", "10:00 AM". Null when the value isn't a date. */
export function meetingTimeParts(iso: string): { weekday: string; month: string; day: string; time: string } | null {
  const date = parse(iso);
  if (!date) return null;
  return { weekday: WEEKDAY.format(date), month: MONTH.format(date), day: DAY.format(date), time: TIME.format(date).replace(/ /g, " ") };
}

/** "Sat, Oct 10, 10:00 AM": the weekday in place of the year, for a time that is weeks away at most. Empty when it isn't a date. */
export function formatMeetingTime(iso: string): string {
  const parts = meetingTimeParts(iso);
  return parts ? `${parts.weekday}, ${parts.month} ${parts.day}, ${parts.time}` : "";
}

/** Today in the Philippines as a date input writes it: "2026-10-08". */
export function philippineToday(now: Date = new Date()): string {
  return INPUT_DATE.format(now);
}

/**
 * A date and a time typed into a form ("2026-10-10", "10:00"), read as Philippine time and written as the API takes
 * it. The Philippines keeps no daylight saving, so it is always 8 hours ahead of UTC. Null when either isn't valid.
 */
export function philippineTimeToIso(date: string, clock: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(clock)) return null;
  const at = new Date(`${date}T${clock}:00+08:00`);
  // "2026-02-30" would roll over into March: not a day anyone picked.
  return Number.isNaN(at.getTime()) || INPUT_DATE.format(at) !== date ? null : at.toISOString();
}
