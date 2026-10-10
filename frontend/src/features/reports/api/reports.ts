import { type ApiClient, apiPath } from "@/lib/api/core";
import { isRecord, isText, readPage, unexpected } from "@/lib/api/readers";
import type { ApiResource, Paginated } from "@/types/api";
import { POST_TYPES, type PostType } from "@/types/post";
import { REPORT_TARGET_TYPES, type ReportTarget, type ReportTargetType } from "@/types/report";
import { ACCOUNT_STATUSES, REPORT_STATUSES, ROLES, type AccountStatus, type ReportStatus, type Role } from "@/types/statuses";
import { isReportAction, isReportReason, reportTargetBody } from "../schemas/reports";
import type {
  FiledReport,
  ItemReport,
  ModerationInput,
  ReportDecision,
  ReportDetail,
  ReportInput,
  ReportParty,
  ReportSummary,
  ReportedAccount,
  ReportedComment,
  ReportedPost,
} from "../types/reports";

// Reports & Moderation calls (docs/api/community-reports-and-admin.md, RP-01…RP-05, FR16, FR32, FR35). The queue
// and the review are read from Server Components with `getServerApi()`; filing a report and taking an action run in
// the browser, where the CSRF token is. Who is reporting and who is acting come from the session, and a report's
// status is the system's, so none of them is ever sent (SEC-AUTHZ-02, FR27). The API checks the admin role on every
// `/admin` call (SEC-AUTHZ-07), and every path with an id is built with apiPath (SEC-FE-08).

const QUEUE = "/admin/reports";
const QUEUE_PROBLEM = "We couldn't load the reports. Please try again.";
const REPORT_PROBLEM = "We couldn't load this report. Please try again.";
const SENT_PROBLEM = "We couldn't tell whether your report was sent. Check your connection before sending it again.";
const ACTION_PROBLEM = "We couldn't confirm the action. Reload the page to see where the report stands.";

const isId = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value > 0;
const idOrNull = (value: unknown) => (isId(value) ? value : null);
const textOrNull = (value: unknown) => (isText(value) && value.trim() !== "" ? value : null);
const isDate = (value: unknown): value is string => isText(value) && !Number.isNaN(new Date(value).getTime());
const dateOrNull = (value: unknown) => (isDate(value) ? value : null);
const oneOf = <T extends string>(list: readonly T[], value: unknown): value is T => (list as readonly unknown[]).includes(value);

function readParty(value: unknown): ReportParty | null {
  if (!isRecord(value) || !isId(value.id) || !isText(value.display_name) || !oneOf<Role>(ROLES, value.role)) return null;
  return { id: value.id, display_name: value.display_name, role: value.role };
}

function readReportedAccount(value: unknown): ReportedAccount | null {
  const party = readParty(value);
  if (!party || !isRecord(value) || !oneOf<AccountStatus>(ACCOUNT_STATUSES, value.status)) return null;
  return {
    ...party,
    status: value.status,
    profile_id: idOrNull(value.profile_id),
    joined_at: dateOrNull(value.joined_at),
    reports_against_count: typeof value.reports_against_count === "number" ? value.reports_against_count : null,
  };
}

function readDecision(value: unknown): ReportDecision | null {
  if (!isRecord(value) || !isId(value.id) || !isReportAction(value.action) || !isDate(value.created_at)) return null;
  return {
    id: value.id,
    action: value.action,
    reason: isText(value.reason) ? value.reason : "",
    notify_reporters: value.notify_reporters === true,
    performed_by: textOrNull(value.performed_by),
    created_at: value.created_at,
  };
}

/**
 * A report as the screens read it, or null when it doesn't match the contract and isn't shown. The screens pick
 * their tabs, badges and actions from `status` and `target_type`, so neither is guessed.
 */
export function toReportSummary(row: unknown): ReportSummary | null {
  if (
    !isRecord(row) ||
    !isId(row.id) ||
    !oneOf<ReportTargetType>(REPORT_TARGET_TYPES, row.target_type) ||
    !isReportReason(row.reason) ||
    !oneOf<ReportStatus>(REPORT_STATUSES, row.status) ||
    !isDate(row.created_at)
  ) {
    return null;
  }
  return {
    id: row.id,
    target_type: row.target_type,
    reason: row.reason,
    details: textOrNull(row.details),
    status: row.status,
    reports_count: typeof row.reports_count === "number" && row.reports_count > 0 ? Math.floor(row.reports_count) : 1,
    post_id: idOrNull(row.post_id),
    comment_id: idOrNull(row.comment_id),
    reporter: readParty(row.reporter),
    reported_user: readReportedAccount(row.reported_user),
    report_action: readDecision(row.report_action),
    created_at: row.created_at,
  };
}

function readPost(value: unknown): ReportedPost | null {
  if (!isRecord(value) || !isId(value.id)) return null;
  const photos = Array.isArray(value.photos) ? value.photos : [];
  return {
    id: value.id,
    type: oneOf<PostType>(POST_TYPES, value.type) ? value.type : null,
    title: textOrNull(value.title),
    body: isText(value.body) ? value.body : "",
    photos: photos.flatMap((photo) => (isRecord(photo) && isId(photo.id) && isText(photo.url) && photo.url !== "" ? [{ id: photo.id, url: photo.url }] : [])),
    // Read strictly: only `true` says so, and a removed post offers Restore.
    is_removed: value.is_removed === true,
    is_deleted: value.is_deleted === true,
    created_at: dateOrNull(value.created_at),
  };
}

function readComment(value: unknown): ReportedComment | null {
  if (!isRecord(value) || !isId(value.id)) return null;
  return { id: value.id, body: isText(value.body) ? value.body : "", is_removed: value.is_removed === true, created_at: dateOrNull(value.created_at) };
}

function readItemReport(value: unknown): ItemReport[] {
  if (!isRecord(value) || !isId(value.id) || !isReportReason(value.reason) || !oneOf<ReportStatus>(REPORT_STATUSES, value.status) || !isDate(value.created_at)) return [];
  return [
    { id: value.id, reporter_name: textOrNull(value.reporter_name), reason: value.reason, details: textOrNull(value.details), status: value.status, created_at: value.created_at },
  ];
}

function readDetail(response: ApiResource<unknown> | null | undefined, problem: string): ReportDetail {
  const data = response?.data;
  const summary = toReportSummary(data);
  if (!summary || !isRecord(data)) throw unexpected(problem);
  const preview = isRecord(data.content_preview) ? data.content_preview : {};
  return {
    ...summary,
    content_preview: { post: readPost(preview.post), comment: readComment(preview.comment) },
    sibling_reports: Array.isArray(data.sibling_reports) ? data.sibling_reports.flatMap(readItemReport) : [],
  };
}

/**
 * Files a report on a post, a comment, a profile or an account (RP-01). Throws ApiError: 422 `fieldErrors` for
 * `reason` and `details`, and for `target_id` when it is the reporter's own; 409 `report_already_open` when they
 * already reported it and it is still being reviewed; 404 when it is gone.
 */
export async function submitReport(client: ApiClient, target: ReportTarget, input: ReportInput): Promise<FiledReport> {
  const response = await client.post<ApiResource<unknown>>("/reports", { ...reportTargetBody(target), reason: input.reason, details: input.details });
  const data = response?.data;
  if (!isRecord(data) || !isId(data.id)) throw unexpected(SENT_PROBLEM);
  return { id: data.id, status: data.status === "resolved" ? "resolved" : "open" };
}

export type ReportFilters = {
  /** Open (the default) or Resolved. */
  status?: ReportStatus;
  page?: number;
  perPage?: number;
};

/** The reported items, one row each, most reported first, a page at a time (RP-03). */
export async function getReports(client: ApiClient, filters: ReportFilters = {}): Promise<Paginated<ReportSummary>> {
  const { status, page, perPage } = filters;
  const response = await client.get<unknown>(QUEUE, { query: { status, page, per_page: perPage } });
  if (!isRecord(response) || !Array.isArray(response.data)) throw unexpected(QUEUE_PROBLEM);
  const rows = response.data.map(toReportSummary);
  return readPage({ ...response, data: rows }, (row): row is ReportSummary => row !== null, QUEUE_PROBLEM);
}

/** How many reported items are open, for the sidebar. One row is asked for; the count comes with it. */
export async function getOpenReportCount(client: ApiClient): Promise<number> {
  return (await getReports(client, { status: "open", perPage: 1 })).meta.total;
}

/** One report with what it is about, every report on the same item and the reported account (RP-04). 404 when there is none. */
export async function getReport(client: ApiClient, reportId: number): Promise<ReportDetail> {
  return readDetail(await client.get<ApiResource<unknown>>(apiPath`/admin/reports/${reportId}`), REPORT_PROBLEM);
}

/**
 * Removes, suspends, dismisses or restores (RP-05, FR35), with the reason the API requires and logs. One action
 * resolves every open report on the item. Throws ApiError: 422 `fieldErrors` for `action` and `reason`; 409
 * `report_already_resolved` when another admin acted first, `nothing_to_restore` when the content isn't removed.
 */
export async function takeReportAction(client: ApiClient, reportId: number, input: ModerationInput): Promise<ReportDetail> {
  const { action, reason, notify_reporters } = input;
  const body = action === "restore_content" ? { action, reason } : { action, reason, notify_reporters: notify_reporters ?? true };
  return readDetail(await client.post<ApiResource<unknown>>(apiPath`/admin/reports/${reportId}/actions`, body), ACTION_PROBLEM);
}
