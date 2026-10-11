import { MOCK_PERSONAS } from "@/lib/api/mock/personas";
import { type MockRoute, fail, ok, paginate, route, validationFailed } from "@/lib/api/mock/router";
import type { Account } from "@/types/account";

// The activity log in mock mode (docs/api/community-reports-and-admin.md, "Activity logs"; LG-01…LG-04), with the
// API's answers and its rules: a member reads their own activity without reasons or an admin's name, an admin reads
// every entry whole, and nothing can be written. The entries follow the LoFi's and are made up (SEC-PRIV-06).

const TYPES = ["verification", "account", "status_change", "request", "meet_and_greet", "adoption", "feed", "profile", "moderation", "announcement", "security", "system"];
const ACTOR_ROLES = ["admin", "pet", "human", "system"];
const EDGE = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0";
const HOUR_MS = 60 * 60 * 1000;
const STARTED_AT = Date.now();

type Target = { kind: "account" | "request" | "report"; id: number };

type Row = {
  id: number;
  type: string;
  action: string;
  /** The acting account's id; null for the system. */
  actor: number | null;
  /** The accounts whose own activity this entry belongs to, besides the actor's. */
  about: number[];
  subject_type: string | null;
  subject_id: number | null;
  subject_label: string | null;
  target: Target | null;
  before_value: string | null;
  after_value: string | null;
  reason: string | null;
  user_agent: string | null;
  created_at: string;
};

const MOCHI = 1;
const ANA = 2;
const ADMIN = 3;

const accounts = Object.values(MOCK_PERSONAS).filter((account): account is Account => account !== null);
const accountById = (id: number) => accounts.find((account) => account.id === id) ?? null;

let nextId = 0;
function entry(hoursAgo: number, type: string, action: string, actor: number | null, rest: Partial<Omit<Row, "id" | "type" | "action" | "actor" | "created_at">> = {}): Row {
  nextId += 1;
  return {
    id: nextId,
    type,
    action,
    actor,
    about: [],
    subject_type: null,
    subject_id: null,
    subject_label: null,
    target: null,
    before_value: null,
    after_value: null,
    reason: null,
    user_agent: null,
    created_at: new Date(STARTED_AT - hoursAgo * HOUR_MS).toISOString(),
    ...rest,
  };
}

const mochiAccount = { about: [MOCHI], subject_type: "User", subject_id: MOCHI, subject_label: "Mochi", target: { kind: "account", id: MOCHI } as Target };
const mochiPet = { about: [MOCHI], subject_type: "Pet", subject_id: 1, subject_label: "Mochi", target: { kind: "account", id: MOCHI } as Target };
const anaAccount = { about: [ANA], subject_type: "User", subject_id: ANA, subject_label: "Ana Santos", target: { kind: "account", id: ANA } as Target };
const anaHome = { about: [ANA], subject_type: "HomeProfile", subject_id: 1, subject_label: "Ana Santos", target: { kind: "account", id: ANA } as Target };
const request1 = { about: [MOCHI, ANA], subject_type: "AdoptionRequest", subject_id: 1, subject_label: "Mochi to Ana Santos", target: { kind: "request", id: 1 } as Target };
const meeting1 = { about: [], subject_type: "MeetAndGreet", subject_id: 1, subject_label: "Mochi to Ana Santos", target: { kind: "request", id: 1 } as Target };

// Oldest first as written; every list answers newest first.
const ROWS: Row[] = [
  entry(700, "verification", "signed_up", MOCHI, { ...mochiAccount, after_value: "pending_verification", user_agent: EDGE }),
  entry(699, "verification", "account_approved", ADMIN, { ...mochiAccount, before_value: "pending_verification", after_value: "active", reason: "Documents complete" }),
  entry(698, "security", "signed_in", MOCHI, { ...mochiAccount, user_agent: EDGE }),
  entry(680, "status_change", "pet_resume_published", null, { ...mochiPet, before_value: "draft", after_value: "looking_for_a_home", reason: "Owner completed and published resume" }),
  entry(620, "profile", "home_profile_updated", ANA, anaHome),
  entry(600, "profile", "pet_photo_added", MOCHI, mochiPet),
  entry(560, "request", "adoption_request_sent", MOCHI, { ...request1, after_value: "sent" }),
  entry(520, "request", "adoption_request_approved", ANA, { ...request1, before_value: "sent", after_value: "approved" }),
  entry(520, "status_change", "pet_status_in_process", null, { ...mochiPet, before_value: "looking_for_a_home", after_value: "in_process", reason: "Request #1 approved" }),
  entry(480, "account", "account_suspended", ADMIN, { subject_type: "User", subject_id: 6, subject_label: "Biscuit", target: { kind: "account", id: 6 }, before_value: "active", after_value: "suspended", reason: "5 confirmed reports: fake profile" }),
  entry(470, "moderation", "report_resolved_remove_content", ADMIN, { subject_type: "Report", subject_id: 4, subject_label: "Report #4", target: { kind: "report", id: 4 }, before_value: "open", after_value: "resolved", reason: "Selling pets is not allowed" }),
  entry(440, "meet_and_greet", "meet_and_greet_booked", MOCHI, { ...meeting1, after_value: "booked" }),
  entry(430, "meet_and_greet", "meet_and_greet_confirmed", ANA, { ...meeting1, before_value: "booked", after_value: "confirmed" }),
  entry(430, "status_change", "adoption_request_meet_scheduled", null, { ...request1, before_value: "approved", after_value: "meet_scheduled" }),
  entry(300, "announcement", "announcement_published", ADMIN, { subject_type: "Announcement", subject_id: 3, subject_label: "Pawfolio Adoption Week starts Oct 10!", after_value: "everyone", reason: "Pawfolio Adoption Week starts Oct 10!" }),
  entry(200, "security", "password_changed", ANA, { ...anaAccount, user_agent: EDGE }),
  entry(120, "feed", "post_created", ANA, { subject_type: "Post", subject_id: 12, subject_label: "Post #12" }),
  entry(72, "moderation", "report_submitted", ANA, { subject_type: "Report", subject_id: 7, subject_label: "Report #7", target: { kind: "report", id: 7 }, reason: "selling_or_trading_animals" }),
  entry(30, "security", "sign_in_failed", null, { user_agent: "curl/8.9.1" }),
  entry(26, "security", "signed_in", ANA, { ...anaAccount, user_agent: EDGE }),
  entry(3, "security", "signed_in", MOCHI, { ...mochiAccount, user_agent: EDGE }),
  entry(1, "security", "signed_in", ADMIN, { subject_type: "User", subject_id: ADMIN, subject_label: "admin.jess", user_agent: EDGE }),
];

const device = (userAgent: string | null) => (userAgent === null ? null : userAgent.includes("Edg") ? "Edge on Windows" : "An unrecognised device");

/** An entry as the API answers it to this reader: whole for an admin, with less for a member. */
function resource(row: Row, viewer: Account, withDetail = false) {
  const forAdmin = viewer.role === "admin";
  const actor = row.actor === null ? null : accountById(row.actor);
  const isYou = actor !== null && actor.id === viewer.id;
  const actorName = actor === null ? "System" : !forAdmin && actor.role === "admin" && !isYou ? "An admin" : actor.display_name;

  return {
    id: row.id,
    type: row.type,
    action: row.action,
    actor: { display_name: actorName, role: actor?.role ?? "system", is_you: isYou, ...(forAdmin && { id: actor?.id ?? null }) },
    subject_type: row.subject_type,
    subject_label: row.subject_label,
    target: row.target !== null && (forAdmin || row.target.kind === "request") ? row.target : null,
    before_value: row.before_value,
    after_value: row.after_value,
    device: forAdmin || row.type === "security" ? device(row.user_agent) : null,
    created_at: row.created_at,
    ...(forAdmin && { subject_id: row.subject_id, reason: row.reason }),
    ...(forAdmin && withDetail && { user_agent: row.user_agent, is_append_only: true }),
  };
}

const newestFirst = (rows: Row[]) => [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id);

/** `?type=request,adoption` as a list, or the field's error when one of them isn't a type. */
function readTypes(value: unknown): string[] | { error: Record<string, string> } {
  const types = typeof value === "string" ? value.split(",").map((type) => type.trim()).filter(Boolean) : [];
  const unknown = types.findIndex((type) => !TYPES.includes(type));
  return unknown === -1 ? types : { error: { [`type.${unknown}`]: "Choose activity types from the list." } };
}

function mine(viewer: Account, types: string[]): Row[] {
  return newestFirst(ROWS.filter((row) => (row.actor === viewer.id || row.about.includes(viewer.id)) && (types.length === 0 || types.includes(row.type))));
}

function all(query: Record<string, unknown>, types: string[]): Row[] | { error: Record<string, string> } {
  const role = query.actor_role;
  if (role !== undefined && role !== "" && (typeof role !== "string" || !ACTOR_ROLES.includes(role))) return { error: { actor_role: "Choose Admins, Pets, Humans or System." } };
  return newestFirst(
    ROWS.filter((row) => {
      const actorRole = row.actor === null ? "system" : (accountById(row.actor)?.role ?? "system");
      return (types.length === 0 || types.includes(row.type)) && (!role || actorRole === role);
    }),
  );
}

const cell = (value: unknown) => {
  const text = value === null || value === undefined ? "" : String(value);
  // As the API: a cell that would start a formula is written as text.
  const safe = /^\s*[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\n]/.test(safe) || safe.includes(" ") ? `"${safe.replace(/"/g, '""')}"` : safe;
};

function csv(rows: Row[], viewer: Account) {
  const forAdmin = viewer.role === "admin";
  const header = ["When (Philippine time)", "Who", "Type", "Action", "About", "Before", "After", ...(forAdmin ? ["Reason"] : []), "Device"];
  const when = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  const lines = rows.map((row) => {
    const shown = resource(row, viewer);
    return [when.format(new Date(row.created_at)), shown.actor.display_name, row.type, row.action, row.subject_label, row.before_value, row.after_value, ...(forAdmin ? [row.reason] : []), shown.device].map(cell).join(",");
  });
  return { status: 200, file: { type: "text/csv; charset=UTF-8", bytes: new TextEncoder().encode([header.map(cell).join(","), ...lines].join("\n") + "\n") } };
}

export const activityLogRoutes: MockRoute[] = [
  route("GET", "/activity", ({ query, account }) => {
    if (!account) return fail(401, "Unauthenticated.");
    const types = readTypes(query.type);
    if (!Array.isArray(types)) return validationFailed(types.error);
    return { status: 200, body: paginate(mine(account, types).map((row) => resource(row, account)), query, "/api/v1/activity") };
  }),

  route("GET", "/activity/export", ({ query, account }) => {
    if (!account) return fail(401, "Unauthenticated.");
    const types = readTypes(query.type);
    if (!Array.isArray(types)) return validationFailed(types.error);
    return csv(mine(account, types), account);
  }),

  route(
    "GET",
    "/admin/activity-logs",
    ({ query, account }) => {
      if (!account) return fail(401, "Unauthenticated.");
      const types = readTypes(query.type);
      if (!Array.isArray(types)) return validationFailed(types.error);
      const rows = all(query, types);
      if (!Array.isArray(rows)) return validationFailed(rows.error);
      return { status: 200, body: paginate(rows.map((row) => resource(row, account)), query, "/api/v1/admin/activity-logs") };
    },
    "admin",
  ),

  route(
    "GET",
    "/admin/activity-logs/export",
    ({ query, account }) => {
      if (!account) return fail(401, "Unauthenticated.");
      const types = readTypes(query.type);
      if (!Array.isArray(types)) return validationFailed(types.error);
      const rows = all(query, types);
      if (!Array.isArray(rows)) return validationFailed(rows.error);
      return csv(rows, account);
    },
    "admin",
  ),

  route(
    "GET",
    "/admin/activity-logs/:entryId",
    ({ params, account }) => {
      const row = /^[1-9]\d*$/.test(params.entryId) ? ROWS.find((candidate) => candidate.id === Number(params.entryId)) : undefined;
      if (!account || !row) return fail(404, "Not found.", { code: "not_found" });
      return ok(resource(row, account, true));
    },
    "admin",
  ),
];
