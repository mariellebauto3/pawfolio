import { mockContentOwner } from "@/lib/api/mock/handlers/community-feed";
import { MOCK_PERSONAS } from "@/lib/api/mock/personas";
import { type MockResult, type MockRoute, fail, ok, paginate, route, validationFailed } from "@/lib/api/mock/router";
import { REPORT_ACTIONS, REPORT_REASONS, REPORT_TARGET_TYPES, type ReportAction, type ReportReason, type ReportTargetType } from "@/types/report";
import type { AccountStatus, ReportStatus, Role } from "@/types/statuses";

// Reports & Moderation in mock mode (docs/api/community-reports-and-admin.md, RP-01…RP-05), with the API's answers:
// a member files a report on a mock post, comment or account; as the "admin" persona the queue lists the LoFi's
// reported items, one row each, most reported first. What is filed or decided lives in memory, so a reload brings
// these back, and a page rendered on the server doesn't see what the browser changed. All of it is made up
// (SEC-PRIV-06).

const OWN_CONTENT = "You cannot report your own content or account.";
export const REPORT_ALREADY_OPEN_CODE = "report_already_open";
export const REPORT_ALREADY_RESOLVED_CODE = "report_already_resolved";
const QUEUE_PATH = "/admin/reports";

const HOUR_MS = 60 * 60 * 1000;
const STARTED_AT = Date.now();
const ago = (hours: number) => new Date(STARTED_AT - hours * HOUR_MS).toISOString();

type Party = { id: number; display_name: string; role: Role };
type Reported = Party & { status: AccountStatus; profile_id: number | null; joined_at: string };

// The accounts that were reported. They exist only here: none of them is a persona or writes on the mock feed.
const REPORTED: Record<number, Reported> = {
  31: { id: 31, display_name: "Bruno", role: "pet", status: "active", profile_id: null, joined_at: ago(24 * 40) },
  32: { id: 32, display_name: "Rico Dantes", role: "human", status: "active", profile_id: null, joined_at: ago(24 * 12) },
  33: { id: 33, display_name: "Chichay", role: "pet", status: "active", profile_id: null, joined_at: ago(24 * 90) },
};

const REPORTERS: Party[] = [
  { id: 2, display_name: "Ana Santos", role: "human" },
  { id: 1, display_name: "Mochi", role: "pet" },
  { id: 23, display_name: "Paolo Garcia", role: "human" },
];

type Content = { id: number; body: string; is_removed: boolean; created_at: string };
const POSTS: Record<number, Content & { type: string; title: string | null; is_deleted: boolean }> = {
  901: { id: 901, type: "update", title: null, body: "Puppies available! 3 months old, ₱5,000 each. Message me to reserve yours.", is_removed: false, is_deleted: false, created_at: ago(30) },
  902: { id: 902, type: "post", title: null, body: "Anyone know a good vet in Marikina that opens on Sundays?", is_removed: false, is_deleted: false, created_at: ago(50) },
};
const COMMENTS: Record<number, Content> = {
  901: { id: 901, body: "Only an idiot would adopt a senior dog.", is_removed: false, created_at: ago(8) },
};

type ReportRow = {
  id: number;
  reporter: Party;
  reported_user_id: number;
  target_type: ReportTargetType;
  post_id: number | null;
  comment_id: number | null;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  action_id: number | null;
  created_at: string;
};

type ActionRow = { id: number; action: ReportAction; reason: string; notify_reporters: boolean; performed_by: string; created_at: string };

const report = (id: number, reporter: number, row: Partial<ReportRow> & Pick<ReportRow, "reported_user_id" | "target_type" | "reason" | "created_at">): ReportRow => ({
  id,
  reporter: REPORTERS[reporter],
  post_id: null,
  comment_id: null,
  details: null,
  status: "open",
  action_id: null,
  ...row,
});

const ACTIONS: ActionRow[] = [{ id: 1, action: "dismiss", reason: "Asking for a vet is not spam.", notify_reporters: true, performed_by: "admin.mark", created_at: ago(40) }];

const REPORTS: ReportRow[] = [
  report(1, 0, { reported_user_id: 31, target_type: "post", post_id: 901, reason: "selling_or_trading_animals", details: "This looks like a sale, not an adoption.", created_at: ago(28) }),
  report(2, 1, { reported_user_id: 31, target_type: "post", post_id: 901, reason: "selling_or_trading_animals", created_at: ago(20) }),
  report(3, 2, { reported_user_id: 31, target_type: "post", post_id: 901, reason: "spam_or_scam", details: "Asked me for a reservation fee.", created_at: ago(3) }),
  report(4, 0, { reported_user_id: 32, target_type: "comment", post_id: 902, comment_id: 901, reason: "harassment_or_hate", created_at: ago(6) }),
  report(5, 2, { reported_user_id: 33, target_type: "profile", reason: "fake_or_misleading_profile", details: "The photos are from a stock site.", created_at: ago(15) }),
  report(6, 1, { reported_user_id: 32, target_type: "post", post_id: 902, reason: "spam_or_scam", status: "resolved", action_id: 1, created_at: ago(45) }),
];

let nextReportId = REPORTS.length + 1;
let nextActionId = ACTIONS.length + 1;

const sameItem = (a: ReportRow, b: ReportRow) =>
  a.reported_user_id === b.reported_user_id && a.target_type === b.target_type && a.post_id === b.post_id && a.comment_id === b.comment_id;

/** The account a report is filed against: one of the reported fixtures, or the author of something on the mock feed. */
function reportedAccount(userId: number): Reported | null {
  if (REPORTED[userId]) return REPORTED[userId];
  const persona = Object.values(MOCK_PERSONAS).find((account) => account?.id === userId && account.role !== "admin");
  return persona ? { id: persona.id, display_name: persona.display_name, role: persona.role, status: persona.status, profile_id: persona.profile_id, joined_at: ago(24 * 30) } : null;
}

function summary(row: ReportRow) {
  const action = ACTIONS.find((candidate) => candidate.id === row.action_id) ?? null;
  const account = reportedAccount(row.reported_user_id);
  return {
    id: row.id,
    target_type: row.target_type,
    reason: row.reason,
    details: row.details,
    status: row.status,
    reports_count: REPORTS.filter((other) => sameItem(other, row) && other.status === row.status).length,
    post_id: row.post_id,
    comment_id: row.comment_id,
    reporter: row.reporter,
    reported_user: account && { id: account.id, display_name: account.display_name, role: account.role, status: account.status, profile_id: account.profile_id },
    report_action: action,
    created_at: row.created_at,
  };
}

function detail(row: ReportRow) {
  const base = summary(row);
  const account = reportedAccount(row.reported_user_id);
  const post = row.post_id !== null ? POSTS[row.post_id] : undefined;
  const comment = row.comment_id !== null ? COMMENTS[row.comment_id] : undefined;
  return {
    ...base,
    reported_user: base.reported_user && {
      ...base.reported_user,
      joined_at: account?.joined_at ?? null,
      reports_against_count: REPORTS.filter((other) => other.reported_user_id === row.reported_user_id).length,
    },
    content_preview: { post: post ? { ...post, photos: [] } : null, comment: comment ?? null },
    sibling_reports: REPORTS.filter((other) => sameItem(other, row))
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
      .map((other) => ({ id: other.id, reporter_id: other.reporter.id, reporter_name: other.reporter.display_name, reason: other.reason, details: other.details, status: other.status, created_at: other.created_at })),
  };
}

const find = (reportId: string) => REPORTS.find((row) => String(row.id) === reportId);
const field = (body: unknown, name: string): unknown => (typeof body === "object" && body !== null ? (body as Record<string, unknown>)[name] : undefined);
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const oneOf = <T extends string>(list: readonly T[], value: unknown): value is T => (list as readonly unknown[]).includes(value);

/** What a report is about, as the API resolves it: whose it is comes from the record, never from the body. */
function resolveTarget(body: unknown, targetType: ReportTargetType): Pick<ReportRow, "reported_user_id" | "post_id" | "comment_id"> | null {
  const id = (name: string) => (typeof field(body, name) === "number" ? (field(body, name) as number) : null);
  if (targetType === "post" || targetType === "comment") {
    const key = targetType === "post" ? id("post_id") : id("comment_id");
    const owner = key === null ? null : mockContentOwner(targetType === "post" ? { post_id: key } : { comment_id: key });
    return owner ? { reported_user_id: owner.id, post_id: targetType === "post" ? key : null, comment_id: targetType === "comment" ? key : null } : null;
  }
  // The mock's pets and homes have no account of their own to look up, so a profile is filed against the id it names.
  const userId = id("reported_user_id") ?? id("pet_id") ?? id("home_profile_id") ?? id("target_id");
  return userId === null ? null : { reported_user_id: userId, post_id: null, comment_id: null };
}

export const reportRoutes: MockRoute[] = [
  route("POST", "/reports", ({ body, account }) => {
    const targetType = field(body, "target_type");
    const reason = field(body, "reason");
    const details = text(field(body, "details"));
    const errors: Record<string, string> = {};
    if (!oneOf(REPORT_TARGET_TYPES, targetType)) errors.target_type = "The selected target type is invalid.";
    if (!oneOf(REPORT_REASONS, reason)) errors.reason = "The selected reason is invalid.";
    else if (reason === "something_else" && !details) errors.details = "Tell us what is wrong, so an admin knows what to look for.";
    if (details.length > 1000) errors.details = "The details field must not be greater than 1000 characters.";
    if (Object.keys(errors).length || !oneOf(REPORT_TARGET_TYPES, targetType) || !oneOf(REPORT_REASONS, reason)) return validationFailed(errors);

    const target = resolveTarget(body, targetType);
    if (!target) return fail(404, "Reported account not found.");
    // Only the documented fields are read; `status` and who is reporting are the system's (SEC-INPUT-04).
    if (target.reported_user_id === account?.id) return { ...validationFailed({ target_id: OWN_CONTENT }), body: { message: OWN_CONTENT, errors: { target_id: [OWN_CONTENT] } } };

    const row: ReportRow = {
      id: nextReportId,
      reporter: { id: account?.id ?? 0, display_name: account?.display_name ?? "", role: account?.role ?? "pet" },
      ...target,
      target_type: targetType,
      reason,
      details: details || null,
      status: "open",
      action_id: null,
      created_at: new Date().toISOString(),
    };
    if (REPORTS.some((other) => other.status === "open" && other.reporter.id === row.reporter.id && sameItem(other, row))) {
      return fail(409, "You already reported this. An admin is reviewing it.", { code: REPORT_ALREADY_OPEN_CODE });
    }
    nextReportId += 1;
    REPORTS.push(row);
    return ok({ id: row.id, target_type: row.target_type, reason: row.reason, status: row.status, created_at: row.created_at }, 201);
  }),

  route(
    "GET",
    QUEUE_PATH,
    ({ query }) => {
      const status = query.status || "open";
      if (status !== "open" && status !== "resolved") return validationFailed({ status: "The selected status is invalid." });
      // One row per reported item: its latest report stands for the others, most reported first, then newest.
      const rows = REPORTS.filter((row) => row.status === status)
        .filter((row, _, all) => !all.some((other) => sameItem(other, row) && other.id > row.id))
        .map(summary)
        .sort((a, b) => b.reports_count - a.reports_count || Date.parse(b.created_at) - Date.parse(a.created_at));
      return { status: 200, body: paginate(rows, query, `/api/v1${QUEUE_PATH}`) };
    },
    "admin",
  ),

  route(
    "GET",
    `${QUEUE_PATH}/:reportId`,
    ({ params }) => {
      const row = find(params.reportId);
      return row ? ok(detail(row)) : fail(404, "Not found.");
    },
    "admin",
  ),

  route(
    "POST",
    `${QUEUE_PATH}/:reportId/actions`,
    ({ params, body, account }): MockResult => {
      const row = find(params.reportId);
      if (!row) return fail(404, "Not found.");
      const action = field(body, "action");
      const reason = text(field(body, "reason"));
      const errors: Record<string, string> = {};
      if (action !== "restore_content" && !oneOf(REPORT_ACTIONS, action)) errors.action = "The selected action is invalid.";
      if (!reason) errors.reason = "Enter a reason for this moderation action.";
      if (Object.keys(errors).length) return validationFailed(errors);

      const content = row.comment_id !== null ? COMMENTS[row.comment_id] : row.post_id !== null ? POSTS[row.post_id] : undefined;
      if (action === "restore_content") {
        if (!content?.is_removed) return fail(409, "There is nothing to restore: this content is not removed.", { code: "nothing_to_restore" });
        content.is_removed = false;
        return ok(detail(row));
      }
      if (!oneOf(REPORT_ACTIONS, action)) return validationFailed({ action: "The selected action is invalid." });
      if (row.status !== "open") return fail(409, "This report was already resolved.", { code: REPORT_ALREADY_RESOLVED_CODE });

      const removes = action === "remove_content" || action === "remove_content_and_suspend";
      const suspends = action === "suspend_account" || action === "remove_content_and_suspend";
      const reported = REPORTED[row.reported_user_id];
      if (removes && !content) return validationFailed({ action: "A profile or an account has nothing to remove. Suspend the account or dismiss the report." });
      if (suspends && reported?.status !== "active") return validationFailed({ action: "This account is not Active, so it cannot be suspended." });

      if (removes && content) content.is_removed = true;
      if (suspends && reported) reported.status = "suspended";
      const decision: ActionRow = { id: nextActionId, action, reason, notify_reporters: field(body, "notify_reporters") !== false, performed_by: account?.display_name ?? "admin", created_at: new Date().toISOString() };
      nextActionId += 1;
      ACTIONS.push(decision);
      for (const other of REPORTS) {
        if (other.status === "open" && sameItem(other, row)) Object.assign(other, { status: "resolved", action_id: decision.id });
      }
      return ok(detail(row));
    },
    "admin",
  ),
];
