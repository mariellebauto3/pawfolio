import type { ApiClient } from "@/lib/api/core";
import { isRecord, isText, readPage, unexpected } from "@/lib/api/readers";
import type { ApiResource } from "@/types/api";
import type { Paginated } from "@/types/api";
import {
  ANNOUNCEMENT_AUDIENCES,
  type AdminAnnouncement,
  type AnnouncementAudience,
  type AnnouncementPage,
  type AudienceCounts,
  type NewAnnouncement,
  type PublishedAnnouncement,
  type StoredAnnouncement,
} from "../types/announcements";

// The admin's announcement calls (docs/api/community-reports-and-admin.md, "Announcements"; NT-04, NT-05, FR39).
// The list is read from a Server Component with `getServerApi()`; publishing runs in the browser, where the CSRF
// token is. Only the title, the message, the audience and the time are sent: who publishes is the session's, and
// whether it is published or scheduled is the API's to say (SEC-AUTHZ-02, SEC-INPUT-04). The API checks the admin
// role (SEC-AUTHZ-07) and logs every announcement with the admin's name (SEC-LOG-01).

const ANNOUNCEMENTS = "/admin/announcements";
const LIST_PROBLEM = "We couldn't load the announcements. Please try again.";
const PUBLISH_PROBLEM = "We couldn't tell whether the announcement went out. Reload the page and check the list before publishing it again.";

const isAudience = (value: unknown): value is AnnouncementAudience => (ANNOUNCEMENT_AUDIENCES as readonly unknown[]).includes(value);
const isDate = (value: unknown): value is string => isText(value) && !Number.isNaN(new Date(value).getTime());
const dateOrNull = (value: unknown) => (isDate(value) ? value : null);

/**
 * An announcement as the screen reads it, or null when it doesn't match the contract and isn't listed. Its status
 * chooses the badge and the date that is shown, so it is never guessed.
 */
export function toAnnouncement(row: unknown): AdminAnnouncement | null {
  if (!isRecord(row) || typeof row.id !== "number" || !isText(row.title) || !isText(row.message) || !isAudience(row.audience) || !isDate(row.created_at)) return null;
  if (row.status !== "published" && row.status !== "scheduled") return null;
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    audience: row.audience,
    status: row.status,
    publish_at: dateOrNull(row.publish_at),
    published_at: dateOrNull(row.published_at),
    admin_name: isText(row.admin_name) && row.admin_name.trim() !== "" ? row.admin_name : null,
    created_at: row.created_at,
  };
}

/** Whole, non-negative counts only: the dialog says "42 Active accounts", so anything else is left unsaid. */
function readCounts(value: unknown): AudienceCounts {
  const counts: AudienceCounts = {};
  if (!isRecord(value)) return counts;
  for (const audience of ANNOUNCEMENT_AUDIENCES) {
    const count = value[audience];
    if (typeof count === "number" && Number.isInteger(count) && count >= 0) counts[audience] = count;
  }
  return counts;
}

/** What was published and what is scheduled, newest first, a page at a time (NT-04). */
export async function getAnnouncements(client: ApiClient, page = 1, perPage?: number): Promise<AnnouncementPage> {
  const response = await client.get<unknown>(ANNOUNCEMENTS, { query: { page: page > 1 ? page : undefined, per_page: perPage } });
  if (!isRecord(response) || !Array.isArray(response.data)) throw unexpected(LIST_PROBLEM);
  const rows = readPage({ ...response, data: response.data.map(toAnnouncement) }, (row): row is AdminAnnouncement => row !== null, LIST_PROBLEM);
  return { ...rows, audienceCounts: readCounts((rows.meta as { audience_counts?: unknown }).audience_counts) };
}

/** Rows on one page of the Announcements tab: the API's own default. */
export const PUBLISHED_ANNOUNCEMENTS_PAGE_SIZE = 20;

/**
 * The announcements published for the caller's role, newest first, for the Announcements tab of Notifications
 * (NT-02, NT-03). A read, so it works from a Server Component. A row that doesn't match the contract isn't listed.
 */
export async function getPublishedAnnouncements(client: ApiClient, page = 1): Promise<Paginated<PublishedAnnouncement>> {
  const query = { page: page > 1 ? page : undefined, per_page: PUBLISHED_ANNOUNCEMENTS_PAGE_SIZE };
  const answered = readPage(await client.get<unknown>("/announcements", { query }), isRecord, LIST_PROBLEM);
  const rows = answered.data.flatMap((row): PublishedAnnouncement[] =>
    typeof row.id === "number" && isText(row.title) && isText(row.message)
      ? [{ id: row.id, title: row.title, message: row.message, published_at: dateOrNull(row.published_at) }]
      : [],
  );
  return { ...answered, data: rows };
}

/**
 * Publishes an announcement now, or schedules it for a time still ahead (NT-05). It reaches the audience's Alerts
 * and the feed and can't be changed or taken back afterwards. Throws ApiError 422 with `fieldErrors` for `title`,
 * `message`, `audience` and `publish_at`.
 */
export async function publishAnnouncement(client: ApiClient, announcement: NewAnnouncement): Promise<StoredAnnouncement> {
  const body = { title: announcement.title, message: announcement.message, audience: announcement.audience, publish_at: announcement.publish_at ?? undefined };
  const data = (await client.post<ApiResource<unknown>>(ANNOUNCEMENTS, body))?.data;
  const stored = toAnnouncement(data);
  if (!stored || !isRecord(data)) throw unexpected(PUBLISH_PROBLEM);
  const notified = data.recipients_notified;
  return { ...stored, recipients_notified: typeof notified === "number" && Number.isInteger(notified) && notified >= 0 ? notified : null };
}
