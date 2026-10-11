import { type ApiClient, apiPath } from "@/lib/api/core";
import { isRecord, isText, readPage, readResolution, unexpected } from "@/lib/api/readers";
import type { ApiResource, Paginated } from "@/types/api";
import type { MeetAndGreet } from "@/types/meet-and-greet";
import { ACCOUNT_STATUSES, type AccountStatus } from "@/types/statuses";
import { type MonitorFilters, monitorTabForApi } from "../schemas/admin-requests";
import type { MonitoredRequest, MonitoredRequestDetail, ReminderSent, ReminderSide, RequestParties } from "../types/admin-requests";
import { readRequest } from "./requests";

// Adoption requests as an admin monitors them (docs/api/adoption-and-meet-greet.md, "The admin's monitor", RQ-18,
// RQ-19, MG-15, MG-16, FR36). The list and a request's record are read from Server Components with
// `getServerApi()`; the reminder runs in the browser, where the CSRF token is. Nothing here changes a request: its
// status is the system's (FR27), and a fix goes through Resolve adoption issue (AL-07). The API checks the admin
// role on every call (SEC-AUTHZ-07), and every path with an id is built with apiPath (SEC-FE-08).

const REQUESTS = "/admin/adoption-requests";
const LIST_PROBLEM = "We couldn't load the requests. Please try again.";
const DETAIL_PROBLEM = "We couldn't load this request. Please try again.";
const REMINDER_PROBLEM = "We couldn't tell whether the reminder went out. Reload the page before sending it again.";

/**
 * Reads a Meet & Greet booking. It belongs to the Meet & Greet module, so the page hands its reader in, as the
 * member's request page does.
 */
export type MeetingReader = (value: unknown) => MeetAndGreet | null;

const isId = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value > 0;
const textOrNull = (value: unknown) => (isText(value) && value.trim() !== "" ? value : null);
const dateOrNull = (value: unknown) => (isText(value) && !Number.isNaN(new Date(value).getTime()) ? value : null);
const statusOrNull = (value: unknown) => ((ACCOUNT_STATUSES as readonly unknown[]).includes(value) ? (value as AccountStatus) : null);
const sideOrNull = (value: unknown): ReminderSide | null => (value === "pet" || value === "human" ? value : null);

/**
 * A request as the monitor reads it, or null when the answer isn't one and the row is left out. "Overdue" chooses
 * a badge and the Resolve link, so anything but a plain `true` reads as not overdue.
 */
export function toMonitoredRequest(row: unknown, readMeeting: MeetingReader): MonitoredRequest | null {
  const request = readRequest(row);
  if (!request || !isRecord(row)) return null;
  return { ...request, updated_at: dateOrNull(row.updated_at), is_overdue: row.is_overdue === true, meeting: readMeeting(row.latest_meet_and_greet) };
}

function readParties(value: unknown): RequestParties {
  const parties = isRecord(value) ? value : {};
  return {
    pet_user_id: isId(parties.pet_user_id) ? parties.pet_user_id : null,
    pet_email: textOrNull(parties.pet_email),
    pet_account_status: statusOrNull(parties.pet_account_status),
    human_user_id: isId(parties.human_user_id) ? parties.human_user_id : null,
    human_email: textOrNull(parties.human_email),
    human_account_status: statusOrNull(parties.human_account_status),
  };
}

/**
 * Every adoption request on the platform, newest first, a page at a time (RQ-18): all of them, the ones that have
 * had a Meet & Greet (MG-15), or the ones overdue for a decision (MG-16), narrowed by a status and by the pet's or
 * the human's name.
 */
export async function getMonitoredRequests(
  client: ApiClient,
  readMeeting: MeetingReader,
  filters: Partial<MonitorFilters> & { page?: number; perPage?: number } = {},
): Promise<Paginated<MonitoredRequest>> {
  const { tab, status, search, page, perPage } = filters;
  const response = await client.get<unknown>(REQUESTS, { query: { tab: tab && monitorTabForApi(tab), status, q: search || undefined, page: page && page > 1 ? page : undefined, per_page: perPage } });
  if (!isRecord(response) || !Array.isArray(response.data)) throw unexpected(LIST_PROBLEM);
  const rows = response.data.map((row) => toMonitoredRequest(row, readMeeting));
  return readPage({ ...response, data: rows }, (row): row is MonitoredRequest => row !== null, LIST_PROBLEM);
}

/** How many requests are overdue for a decision, for the sidebar and the Overdue tab. One row is asked for; the count comes with it. */
export async function getOverdueRequestCount(client: ApiClient): Promise<number> {
  return (await getMonitoredRequests(client, () => null, { tab: "overdue", perPage: 1 })).meta.total;
}

/** One request's record: its milestones, its Meet & Greet, the two accounts and what admins changed (RQ-19). 404 when there is none. */
export async function getMonitoredRequest(client: ApiClient, requestId: number, readMeeting: MeetingReader): Promise<MonitoredRequestDetail> {
  const data = (await client.get<ApiResource<unknown>>(apiPath`/admin/adoption-requests/${requestId}`))?.data;
  const request = toMonitoredRequest(data, readMeeting);
  if (!request || !isRecord(data)) throw unexpected(DETAIL_PROBLEM);
  const reminder = isRecord(data.reminder) ? data.reminder : {};
  const waitingOn = sideOrNull(reminder.waiting_on);

  return {
    ...request,
    parties: readParties(data.parties),
    reminder: {
      waiting_on: waitingOn,
      last_sent_at: dateOrNull(reminder.last_sent_at),
      // Offered only on a plain `true` for a side that waits, so a reminder the API would refuse isn't offered.
      can_send: waitingOn !== null && reminder.can_send === true,
    },
    resolutions: Array.isArray(data.resolutions) ? data.resolutions.flatMap((row) => readResolution(row) ?? []) : [],
  };
}

/**
 * Reminds the side a request waits on (RQ-19). Nothing is sent but the request's id: who is reminded, and in which
 * words, is the API's to say. Throws ApiError 409 with a message to show: `no_reminder_needed` when nobody has a
 * step to take, `already_reminded` when one went out in the last 24 hours.
 */
export async function sendRequestReminder(client: ApiClient, requestId: number): Promise<ReminderSent> {
  const data = (await client.post<ApiResource<unknown>>(apiPath`/admin/adoption-requests/${requestId}/remind`))?.data;
  const recipient = isRecord(data) ? sideOrNull(data.recipient) : null;
  if (!isRecord(data) || data.reminded !== true || recipient === null) throw unexpected(REMINDER_PROBLEM);
  return { recipient, recipient_name: textOrNull(data.recipient_name) };
}
