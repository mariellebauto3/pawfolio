import { RESOLUTION_ACTION_DONE } from "@/constants/adoption-resolutions";
import { slotPlace } from "@/constants/meet-and-greet";
import type { BadgeTone, StatusName } from "@/constants/status-badges";
import { REQUEST_STATUS_LABELS } from "@/constants/statuses";
import { formatMeetingTime } from "@/lib/utils/format-date";
import type { IsoDateTime } from "@/types/api";
import { REQUEST_STATUSES, type RequestStatus } from "@/types/statuses";
import type { MonitoredRequest, MonitoredRequestDetail, ReminderSide } from "../types/admin-requests";
import { requestTimeline } from "./request-status";

// The admin's monitor of adoption requests (RQ-18, RQ-19, MG-15, MG-16, FR36): what its address says, and how a
// request is told to someone who is neither side of it. Everything is read-only here. A status is a filter of what
// to list, never something to set (FR27).

export const MONITOR_TAB_PARAM = "tab";
export const MONITOR_STATUS_PARAM = "status";
export const MONITOR_SEARCH_PARAM = "q";
export const MONITOR_PAGE_PARAM = "page";

/** The search box takes this many characters, like the API's `q`. */
export const MONITOR_SEARCH_MAX = 100;

/** The monitor's tabs (LoFi RQ-18, MG-15, MG-16), with the value the API takes for each. */
export const MONITOR_TABS = [
  { id: "all", label: "All requests", api: undefined },
  { id: "meet-and-greets", label: "Meet & Greets", api: "meet_and_greets" },
  { id: "overdue", label: "Overdue", api: "overdue" },
] as const;
export type MonitorTab = (typeof MONITOR_TABS)[number]["id"];

export const MONITOR_STATUS_OPTIONS = REQUEST_STATUSES.map((status) => ({ value: status, label: REQUEST_STATUS_LABELS[status] }));

export type MonitorFilters = { tab: MonitorTab; status: RequestStatus | undefined; search: string | undefined };

type UrlParams = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** The monitor's filters from the page's URL. Anything the API doesn't know is dropped, so it is never sent as typed. */
export function monitorFiltersFromUrl(params: UrlParams): MonitorFilters {
  const tab = first(params[MONITOR_TAB_PARAM]);
  const status = first(params[MONITOR_STATUS_PARAM]);
  const search = first(params[MONITOR_SEARCH_PARAM])?.trim().slice(0, MONITOR_SEARCH_MAX);
  return {
    tab: MONITOR_TABS.find((candidate) => candidate.id === tab)?.id ?? "all",
    status: (REQUEST_STATUSES as readonly string[]).includes(status ?? "") ? (status as RequestStatus) : undefined,
    search: search || undefined,
  };
}

/** The tab as the API names it; nothing for "All requests". */
export const monitorTabForApi = (tab: MonitorTab) => MONITOR_TABS.find((candidate) => candidate.id === tab)?.api;

/** A request's id from its page's address, or null when it isn't a plain id (SEC-FE-08). */
export function requestIdFromUrl(value: string): number | null {
  return /^[1-9]\d{0,14}$/.test(value) ? Number(value) : null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days a request has been Awaiting Decision. Null when it isn't, or the API gave no date for it. */
export function daysWithoutDecision(request: Pick<MonitoredRequest, "status" | "awaiting_decision_at">, now: Date = new Date()): number | null {
  if (request.status !== "awaiting_decision" || !request.awaiting_decision_at) return null;
  const since = new Date(request.awaiting_decision_at).getTime();
  return Number.isNaN(since) ? null : Math.max(Math.floor((now.getTime() - since) / DAY_MS), 0);
}

/** "No decision for 9 days", under the Overdue badge. Empty when the days can't be counted. */
export function overdueNote(request: Pick<MonitoredRequest, "status" | "awaiting_decision_at">, now: Date = new Date()): string {
  const days = daysWithoutDecision(request, now);
  return days === null ? "" : `No decision for ${days} ${days === 1 ? "day" : "days"}`;
}

/** The latest Meet & Greet of a request in two lines: when, and where with what became of it. Null when none was booked. */
export function meetingLines(request: Pick<MonitoredRequest, "meeting" | "status">): { when: string; where: string; state: string } | null {
  const meeting = request.meeting;
  if (!meeting?.slot) return null;
  // A confirmed booking that ended with nobody ending it reached its time; any other ended one was cancelled or moved.
  const reachedItsTime = meeting.status === "ended" && meeting.confirmed_at !== null && meeting.ended_by === null && meeting.end_reason === null;
  const state = meeting.status === "booked" ? "Waiting for the human to confirm" : meeting.status === "confirmed" ? "Confirmed" : reachedItsTime ? "Its time has passed" : "Ended before it took place";
  return { when: formatMeetingTime(meeting.slot.starts_at), where: slotPlace(meeting.slot), state };
}

/** Who the request waits on, in a sentence. Null when it waits on nobody. */
export function waitingOnLine(request: Pick<MonitoredRequestDetail, "status" | "pet" | "home_profile" | "meeting" | "reminder">): string | null {
  const side = request.reminder.waiting_on;
  if (side === null) return null;
  const pet = request.pet.name;
  const home = request.home_profile.full_name;
  if (side === "pet") return `Waiting on ${pet} to book a Meet & Greet.`;
  if (request.status === "sent") return `Waiting on ${home} to approve or decline.`;
  if (request.status === "approved") return `Waiting on ${home} to confirm the Meet & Greet.`;
  return `Waiting on ${home} to choose Adopt or Decline.`;
}

/** Why no reminder can be sent now, in a sentence. */
export function noReminderLine(request: Pick<MonitoredRequestDetail, "status" | "reminder">): string {
  if (request.reminder.waiting_on !== null) return "A reminder went out in the last 24 hours. Another can be sent tomorrow.";
  if (request.status === "on_hold") return "On Hold while another request of this pet is in process. Nobody has a step to take.";
  if (request.status === "meet_scheduled") return "The Meet & Greet is confirmed and still ahead. Nobody has a step to take.";
  return "This request has ended. Nobody has a step to take.";
}

export const reminderSideName = (side: ReminderSide, request: Pick<MonitoredRequest, "pet" | "home_profile">) => (side === "pet" ? request.pet.name : request.home_profile.full_name);

/** One line of the record's timeline, for the shared Timeline. */
export type AdminRequestEvent = {
  id: string;
  title: string;
  at: IsoDateTime;
  status?: StatusName;
  tone?: BadgeTone;
  description?: string;
  upcoming?: boolean;
};

/**
 * A request's timeline as an admin reads it (RQ-19), oldest first: the milestones the API keeps a date for, its
 * latest Meet & Greet booking, the day it was flagged overdue, and what admins changed by hand, each with its reason
 * (NFR9). A step with no date isn't shown, so nothing is made up.
 */
export function adminRequestTimeline(request: MonitoredRequestDetail): AdminRequestEvent[] {
  const { pet, home_profile: home, meeting } = request;
  const events: AdminRequestEvent[] = requestTimeline(request, "admin").map((event) => {
    if (event.id === "meet_scheduled") return { ...event, title: `${home.full_name} confirmed the Meet & Greet`, description: "Each side’s contact details were shared with the other." };
    if (event.id === "awaiting_decision") return { ...event, description: `${home.full_name} is reminded daily to choose Adopt or Decline.` };
    return event;
  });

  if (meeting?.booked_at && meeting.slot) {
    events.push({ id: "booked", title: `${pet.name} booked a Meet & Greet`, at: meeting.booked_at, description: `${formatMeetingTime(meeting.slot.starts_at)}, ${slotPlace(meeting.slot)}` });
  }
  if (request.overdue_flagged_at) {
    events.push({ id: "overdue", title: "Flagged overdue for follow-up", at: request.overdue_flagged_at, tone: "attention", description: "No decision 7 days after the meeting time." });
  }
  for (const resolution of request.resolutions) {
    events.push({
      id: `resolution-${resolution.id}`,
      title: `${resolution.admin_name ?? "An admin"} ${RESOLUTION_ACTION_DONE[resolution.action]}`,
      at: resolution.created_at,
      tone: "attention",
      description: `Reason: ${resolution.reason}`,
    });
  }

  // Oldest first; what is still to come stays last, and events of the same moment keep the order they were told in.
  const time = (event: AdminRequestEvent) => new Date(event.at).getTime();
  return events
    .filter((event) => !Number.isNaN(time(event)))
    .map((event, index) => ({ event, index }))
    .sort((a, b) => Number(a.event.upcoming ?? false) - Number(b.event.upcoming ?? false) || time(a.event) - time(b.event) || a.index - b.index)
    .map(({ event }) => event);
}
