import { ACCOUNT_STATUS_LABELS, PET_STATUS_LABELS } from "@/constants/statuses";
import type { IsoDateTime } from "@/types/api";
import { ACCOUNT_STATUSES, PET_STATUSES, type RequestStatus } from "@/types/statuses";
import { VIEW_SOURCES, type ViewSource } from "@/types/profile-view";
import type { DayCount, HumanStats, MonthTrend, PetStats, PlatformDashboard, ScoreBand } from "../types/stats";

// How the analytics numbers are put into words and into charts (AN-01…AN-03). Everything here is a pure function
// of what the API answered: nothing is counted again in the browser, only grouped and named.

/** How a bar is filled: blue for a count, yellow for good news (Hired, a match), gray for what is over or not yet. */
export type BarTone = "primary" | "accent" | "muted";
export type Bar = { id: string; label: string; value: number; tone?: BarTone };

/** "1 view", "3 views". */
export const plural = (value: number, one: string, many = `${one}s`) => `${value} ${value === 1 ? one : many}`;

/** "+3 this week", under a total. */
export const thisWeekNote = (value: number) => (value > 0 ? `+${value} this week` : "None this week");

/** Where a human found the resume, as the pages are named. */
export const VIEW_SOURCE_LABELS: Record<ViewSource, string> = {
  matches: "Pets for You",
  browse: "Browse",
  search: "Search",
  bookmarks: "Bookmarks",
  feed: "Community feed",
  direct: "A link or the address bar",
};

/** Where views came from, most first; equal counts keep the order above. */
export function viewSourceBars(sources: PetStats["views_by_source"]): Bar[] {
  return VIEW_SOURCES.map((source) => ({ id: source, label: VIEW_SOURCE_LABELS[source], value: sources[source] })).sort((a, b) => b.value - a.value);
}

const OUTCOME_GROUPS: { id: string; label: string; statuses: RequestStatus[]; tone: BarTone }[] = [
  { id: "open", label: "Open", statuses: ["sent", "on_hold", "approved", "meet_scheduled", "awaiting_decision"], tone: "primary" },
  { id: "adopted", label: "Adopted", statuses: ["adopted"], tone: "accent" },
  { id: "declined", label: "Declined", statuses: ["declined", "not_adopted"], tone: "muted" },
  { id: "withdrawn", label: "Withdrawn", statuses: ["withdrawn"], tone: "muted" },
  { id: "ended", label: "Expired or closed", statuses: ["expired", "closed"], tone: "muted" },
];

/** A human's requests by how they ended, or that they are still open (AN-02). */
export function requestOutcomeBars(outcomes: HumanStats["request_outcomes"]): Bar[] {
  return OUTCOME_GROUPS.map(({ id, label, statuses, tone }) => ({ id, label, tone, value: statuses.reduce((sum, status) => sum + outcomes[status], 0) }));
}

/** "90–100%", and "Below 60%" for the band that starts at 0. */
export const scoreBandLabel = (band: Pick<ScoreBand, "from" | "to">) => (band.from <= 0 ? `Below ${band.to + 1}%` : `${band.from}–${band.to}%`);

/** The match score bands as columns, weakest first so the chart reads left to right like a score. */
export function scoreBandColumns(bands: ScoreBand[]): Bar[] {
  return [...bands].sort((a, b) => a.from - b.from).map((band) => ({ id: `${band.from}-${band.to}`, label: scoreBandLabel(band), value: band.count, tone: "accent" }));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Oct 10" from "2026-10-10". The API already counted the day in Philippine time, so no clock is involved. */
export function dayLabel(date: string): string {
  const [, month, day] = date.split("-").map(Number);
  return MONTHS[month - 1] ? `${MONTHS[month - 1]} ${day}` : date;
}

/** "Oct" from "2026-10". */
export function monthLabel(month: string): string {
  return MONTHS[Number(month.split("-")[1]) - 1] ?? month;
}

/** "October 2026" would be too long under a column; the year is added only where the months cross it. */
export function monthLabels(trends: Pick<MonthTrend, "month">[]): string[] {
  const years = new Set(trends.map((trend) => trend.month.slice(0, 4)));
  return trends.map((trend) => (years.size > 1 ? `${monthLabel(trend.month)} ’${trend.month.slice(2, 4)}` : monthLabel(trend.month)));
}

export const totalViews = (days: DayCount[]) => days.reduce((sum, day) => sum + day.count, 0);

/**
 * The top of a chart's scale: the next round number above the largest value, so the tallest mark never touches
 * the edge and the middle line is a whole number. Never below 4, so a single view doesn't fill the chart.
 */
export function niceMax(values: number[]): number {
  const largest = Math.max(0, ...values);
  if (largest <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(largest));
  const step = [1, 2, 4, 5, 10].find((candidate) => candidate * magnitude >= largest) ?? 10;
  return step * magnitude;
}

/** The pets by status, in the order a pet moves through them (AN-03). */
export function petStatusBars(pets: PlatformDashboard["tiles"]["pets_by_status"]): Bar[] {
  const tones: Record<(typeof PET_STATUSES)[number], BarTone> = { draft: "muted", looking_for_a_home: "primary", in_process: "primary", adopted_hired: "accent" };
  return PET_STATUSES.map((status) => ({ id: status, label: PET_STATUS_LABELS[status], value: pets[status], tone: tones[status] }));
}

/** The accounts by status, Active first (AN-03). */
export function accountStatusSegments(accounts: PlatformDashboard["tiles"]["accounts"]): { id: string; label: string; value: number }[] {
  const order = ["active", "pending_verification", "suspended", "denied", "deactivated"] as const satisfies readonly (typeof ACCOUNT_STATUSES)[number][];
  return order.map((status) => ({ id: status, label: ACCOUNT_STATUS_LABELS[status], value: accounts[status] }));
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days since a moment; null when it isn't a date. A clock that runs behind the server's reads as 0. */
export function daysSince(iso: IsoDateTime | null, now: Date = new Date()): number | null {
  if (!iso) return null;
  const at = new Date(iso).getTime();
  return Number.isNaN(at) ? null : Math.max(Math.floor((now.getTime() - at) / DAY_MS), 0);
}

/** "Oldest has waited 2 days", under the verification queue's count. */
export function oldestWaitNote(oldest: IsoDateTime | null, now: Date = new Date()): string {
  const days = daysSince(oldest, now);
  if (days === null) return "Nobody is waiting";
  return days === 0 ? "Oldest came in today" : `Oldest has waited ${plural(days, "day")}`;
}

/** "23.5 days" as a tile writes it: one decimal only when there is one. */
export const averageDays = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));

/** "Pepper, Carla Mendoza and 2 more", the accounts that have waited longest. Empty when there are none. */
export function waitingNames(names: string[], total: number): string {
  const shown = names.slice(0, 2);
  const more = total - shown.length;
  if (shown.length === 0) return "";
  if (more > 0) return `${shown.join(", ")} and ${more} more`;
  return shown.join(" and ");
}
