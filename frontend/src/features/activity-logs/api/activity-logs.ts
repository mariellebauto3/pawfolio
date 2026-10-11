import { type ApiClient, apiPath } from "@/lib/api/core";
import { isRecord, isText, readPage, unexpected } from "@/lib/api/readers";
import type { ApiResource, Paginated } from "@/types/api";
import type { LogFilters } from "../schemas/activity-logs";
import { ACTIVITY_TYPES, ACTOR_ROLES, type ActivityActor, type ActivityEntry, type ActivityEntryDetail, type ActivityTarget, type ActivityType, type ActorRole } from "../types/activity-logs";

// The activity log calls (docs/api/community-reports-and-admin.md, "Activity logs"; LG-01…LG-04, FR41). The lists
// are read from Server Components with `getServerApi()`; one entry's detail and the CSV exports run in the browser.
// Every call only reads: the log has no update and no delete (SEC-LOG-04). Whose activity `/activity` lists is the
// session's to say, never a parameter (SEC-AUTHZ-02); the API checks the admin role on the platform's log itself
// (SEC-AUTHZ-07), and the one path with an id is built with apiPath (SEC-FE-08).

const MINE = "/activity";
const ALL = "/admin/activity-logs";
const MINE_PROBLEM = "We couldn't load your activity. Please try again.";
const ALL_PROBLEM = "We couldn't load the activity logs. Please try again.";
const ENTRY_PROBLEM = "We couldn't load this entry. Please try again.";

/** The only kind of file an export may be. Anything else the API answers with is refused (SEC-FE-09). */
const CSV = ["text/csv"] as const;

const textOrNull = (value: unknown) => (isText(value) && value.trim() !== "" ? value : null);
const isId = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value > 0;

function readActor(value: unknown): ActivityActor | null {
  if (!isRecord(value) || !(ACTOR_ROLES as readonly unknown[]).includes(value.role)) return null;
  const role = value.role as ActorRole;
  return {
    id: isId(value.id) ? value.id : null,
    display_name: textOrNull(value.display_name) ?? (role === "system" ? "System" : role === "admin" ? "An admin" : "Someone"),
    role,
    // Only a plain `true`: "you did this" is never guessed.
    is_you: value.is_you === true,
  };
}

function readTarget(value: unknown): ActivityTarget | null {
  if (!isRecord(value) || !isId(value.id)) return null;
  return value.kind === "account" || value.kind === "request" || value.kind === "report" ? { kind: value.kind, id: value.id } : null;
}

/** An entry as the screens read it, or null when the row isn't one and is left out. */
export function toActivityEntry(row: unknown): ActivityEntry | null {
  if (!isRecord(row) || !isId(row.id) || !isText(row.action) || row.action === "") return null;
  if (!(ACTIVITY_TYPES as readonly unknown[]).includes(row.type)) return null;
  if (!isText(row.created_at) || Number.isNaN(new Date(row.created_at).getTime())) return null;
  const actor = readActor(row.actor);
  if (!actor) return null;

  return {
    id: row.id,
    type: row.type as ActivityType,
    action: row.action,
    actor,
    subject_type: textOrNull(row.subject_type),
    subject_label: textOrNull(row.subject_label),
    target: readTarget(row.target),
    before_value: textOrNull(row.before_value),
    after_value: textOrNull(row.after_value),
    reason: textOrNull(row.reason),
    device: textOrNull(row.device),
    created_at: row.created_at,
  };
}

function readEntries(response: unknown, problem: string): Paginated<ActivityEntry> {
  if (!isRecord(response) || !Array.isArray(response.data)) throw unexpected(problem);
  return readPage({ ...response, data: response.data.map(toActivityEntry) }, (row): row is ActivityEntry => row !== null, problem);
}

const page = (value: number | undefined) => (value && value > 1 ? value : undefined);
const typeQuery = (types: readonly ActivityType[] | undefined) => (types && types.length > 0 ? types.join(",") : undefined);
const logQuery = (filters: Partial<LogFilters>) => ({ type: filters.type, actor_role: filters.actor });

/** The signed-in account's own activity, newest first, a page at a time (LG-01, LG-02). */
export async function getMyActivity(client: ApiClient, options: { types?: readonly ActivityType[]; page?: number; perPage?: number } = {}): Promise<Paginated<ActivityEntry>> {
  const response = await client.get<unknown>(MINE, { query: { type: typeQuery(options.types), page: page(options.page), per_page: options.perPage } });
  return readEntries(response, MINE_PROBLEM);
}

/** Every entry on the platform, newest first, narrowed by who acted and by type (LG-03). */
export async function getActivityLogs(client: ApiClient, filters: Partial<LogFilters> & { page?: number; perPage?: number } = {}): Promise<Paginated<ActivityEntry>> {
  const response = await client.get<unknown>(ALL, { query: { ...logQuery(filters), page: page(filters.page), per_page: filters.perPage } });
  return readEntries(response, ALL_PROBLEM);
}

/** One entry in full, with the device it came from (LG-04). 404 when there is none. */
export async function getActivityLogEntry(client: ApiClient, entryId: number, options: { signal?: AbortSignal } = {}): Promise<ActivityEntryDetail> {
  const data = (await client.get<ApiResource<unknown>>(apiPath`/admin/activity-logs/${entryId}`, { signal: options.signal }))?.data;
  const entry = toActivityEntry(data);
  if (!entry || !isRecord(data)) throw unexpected(ENTRY_PROBLEM);
  return { ...entry, user_agent: textOrNull(data.user_agent) };
}

/** The account's own activity as a CSV file, with the same types as the list shows. */
export function downloadMyActivity(client: ApiClient, types?: readonly ActivityType[]): Promise<Blob> {
  return client.getFile(`${MINE}/export`, { accept: CSV, query: { type: typeQuery(types) } });
}

/** The platform's log as a CSV file, with the same filters as the list shows. */
export function downloadActivityLogs(client: ApiClient, filters: Partial<LogFilters> = {}): Promise<Blob> {
  return client.getFile(`${ALL}/export`, { accept: CSV, query: logQuery(filters) });
}
