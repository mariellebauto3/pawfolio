import { MOCK_PASSWORD, MOCK_PERSONAS } from "@/lib/api/mock/personas";
import { type MockResult, type MockRoute, fail, ok, paginate, route, validationFailed } from "@/lib/api/mock/router";
import { firstPasswordProblem } from "@/lib/auth/password-rules";
import { normalizeContactNumber } from "@/lib/auth/sign-up-rules";
import type { Account } from "@/types/account";
import type { AccountStatus } from "@/types/statuses";

// Settings and Account Administration in mock mode (docs/api/community-reports-and-admin.md, AC-01…AC-10), with the
// API's answers: as `pet` or `human`, `/settings` reads and saves the persona's own details; as `admin`,
// `/admin/accounts` lists the personas that are pets and humans. What is saved or decided lives in memory, so a
// reload brings these back, and a page rendered on the server doesn't see what the browser changed. Deactivating
// your own account answers as the API does but signs nobody out. All of it is made up (SEC-PRIV-06).

const STARTED_AT = Date.now();
const ago = (days: number) => new Date(STARTED_AT - days * 24 * 60 * 60 * 1000).toISOString();

type Details = {
  locked: Record<string, string | number>;
  contact: Record<string, string>;
  preferences: Record<string, boolean>;
  changeRequests: { id: number; field: string; new_value: string; reason: string; status: "pending" | "approved" | "denied"; has_document: boolean; reviewed_at: string | null; created_at: string }[];
};

const PREFERENCES = ["requests_and_invites", "meet_and_greets", "post_activity", "announcements"];
const allOn = () => Object.fromEntries(PREFERENCES.map((key) => [key, true]));

const DETAILS: Record<number, Details> = {
  1: {
    locked: { name: "Mochi", species: "dog", breed: "Aspin", approximate_age_months: 24 },
    contact: { caretaker_name: "Joy Lim", caretaker_contact_number: "09171234567" },
    preferences: allOn(),
    changeRequests: [],
  },
  2: {
    locked: { full_name: "Ana Santos", birthdate: "1990-03-04", city: "Quezon City", province: "Metro Manila" },
    contact: { contact_number: "09181234567", street_address: "12 Sample St., Brgy. Example" },
    preferences: { ...allOn(), post_activity: false },
    changeRequests: [],
  },
};

const LOCKED: Record<"pet" | "human", string[]> = { pet: ["name", "species", "breed", "approximate_age_months"], human: ["full_name", "birthdate", "city", "province"] };
let nextChangeRequestId = 1;

const field = (body: unknown, name: string): unknown => (body instanceof FormData ? body.get(name) : typeof body === "object" && body !== null ? (body as Record<string, unknown>)[name] : undefined);
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

function detailsOf(account: Account): Details {
  DETAILS[account.id] ??= { locked: {}, contact: {}, preferences: allOn(), changeRequests: [] };
  return DETAILS[account.id];
}

function settings(account: Account): MockResult {
  const details = detailsOf(account);
  return ok({
    account: { id: account.id, role: account.role, status: account.status, email: account.email, display_name: account.display_name },
    locked_details: details.locked,
    contact_details: details.contact,
    notification_preferences: details.preferences,
    change_requests: [...details.changeRequests].reverse(),
  });
}

// ---- Admin

type Row = { account: Account; status: AccountStatus; actions: { id: number; action: string; reason: string; performed_by: string; by_owner: boolean; created_at: string }[] };

const ROWS: Row[] = Object.values(MOCK_PERSONAS)
  .filter((account): account is Account => account !== null && account.role !== "admin")
  // One row per account: the resubmitted persona is the denied one, later.
  .filter((account, index, all) => all.findIndex((other) => other.id === account.id) === index)
  .map((account) => ({ account, status: account.status, actions: [] }));
let nextActionId = 1;

function summary({ account, status }: Row) {
  return {
    id: account.id,
    role: account.role,
    status,
    email: account.email,
    display_name: account.display_name,
    avatar_url: account.avatar_url,
    profile_id: account.profile_id,
    pet: account.role === "pet" ? { id: account.profile_id, name: account.display_name, city: "Quezon City", status: account.id === 9 ? "adopted_hired" : "looking_for_a_home", photo_url: null } : null,
    home_profile: account.role === "human" ? { id: account.profile_id, full_name: account.display_name, city: "Quezon City", profile_photo_url: null, is_furparent: account.id === 2 } : null,
    caretaker_name: account.role === "pet" ? "Joy Lim" : null,
    adoption: account.id === 9 ? { id: 1, furparent_name: "Ana Santos", adopted_at: ago(20) } : null,
    created_at: ago(30 + account.id),
  };
}

function detail(row: Row) {
  return {
    ...summary(row),
    account_actions: [...row.actions].reverse(),
    verification: row.status === "pending_verification" ? { status: "pending", submitted_at: ago(2), reviewed_at: null, reviewed_by: null, documents: [{ id: 1, type: "valid_id" }] } : { status: row.status === "denied" ? "denied" : "approved", submitted_at: ago(29), reviewed_at: ago(28), reviewed_by: "admin.jess", documents: [{ id: 1, type: "valid_id" }] },
    requests: [],
    reports_against: { total: 0, open: 0, latest: [] },
    detail_change_requests: (DETAILS[row.account.id]?.changeRequests ?? []).map((request) => ({ ...request, current_value: String(DETAILS[row.account.id]?.locked[request.field] ?? ""), reviewed_by: null })).reverse(),
    recent_activity: [],
  };
}

const findRow = (accountId: string) => ROWS.find((row) => String(row.account.id) === accountId);

function act(action: "suspend" | "reactivate" | "deactivate", allowed: (status: AccountStatus) => boolean, conflict: [string, string], next: AccountStatus): MockRoute {
  return route(
    "POST",
    `/admin/accounts/:accountId/${action}`,
    ({ params, body, account }) => {
      const row = findRow(params.accountId);
      if (!row) return fail(404, "Account not found.");
      const reason = text(field(body, "reason"));
      if (!reason) return validationFailed({ reason: "Enter a reason." });
      if (!allowed(row.status)) return fail(409, conflict[0], { code: conflict[1] });
      row.status = next;
      row.actions.push({ id: nextActionId++, action, reason, performed_by: account?.display_name ?? "admin", by_owner: false, created_at: new Date().toISOString() });
      return ok(summary(row));
    },
    "admin",
  );
}

export const accountRoutes: MockRoute[] = [
  route("GET", "/settings", ({ account }) => (account ? settings(account) : fail(401, "Unauthenticated."))),

  route("PATCH", "/settings", ({ account, body }) => {
    if (!account) return fail(401, "Unauthenticated.");
    const details = detailsOf(account);
    // Only the documented fields are read; a role, a status or a locked detail is ignored (SEC-INPUT-04).
    for (const name of ["caretaker_contact_number", "contact_number"]) {
      const value = field(body, name);
      if (typeof value !== "string") continue;
      const number = normalizeContactNumber(value);
      if (!number) return validationFailed({ [name]: "Enter a mobile number like 0917 123 4567." });
      details.contact[name] = number;
    }
    for (const name of ["caretaker_name", "street_address"]) {
      const value = text(field(body, name));
      if (value) details.contact[name] = value;
    }
    const preferences = field(body, "notification_preferences");
    if (typeof preferences === "object" && preferences !== null) {
      for (const [key, value] of Object.entries(preferences)) if (PREFERENCES.includes(key) && typeof value === "boolean") details.preferences[key] = value;
    }
    return settings(account);
  }),

  route("POST", "/settings/password", ({ body }) => {
    const current = field(body, "current_password");
    const password = text(field(body, "password"));
    if (current !== MOCK_PASSWORD) return validationFailed({ current_password: "Your current password is incorrect." });
    const weak = password ? firstPasswordProblem(password) : "Enter a new password.";
    if (weak) return validationFailed({ password: weak });
    if (password !== field(body, "password_confirmation")) return validationFailed({ password: "The passwords don't match." });
    if (password === MOCK_PASSWORD) return validationFailed({ password: "Choose a password that is different from your current one." });
    return ok({ password_changed: true });
  }),

  route("POST", "/settings/deactivate", ({ body }) => {
    if (field(body, "password") !== MOCK_PASSWORD) return validationFailed({ password: "Your password is incorrect." });
    return ok({ deactivated: true });
  }),

  route("POST", "/settings/change-requests", ({ account, body }) => {
    if (!account || (account.role !== "pet" && account.role !== "human")) return fail(401, "Unauthenticated.");
    const details = detailsOf(account);
    const name = text(field(body, "field"));
    const value = text(field(body, "new_value"));
    const reason = text(field(body, "reason"));
    const errors: Record<string, string> = {};
    if (!LOCKED[account.role].includes(name)) errors.field = "Choose the detail to change.";
    if (!value) errors.new_value = "Enter the new value.";
    else if (value === String(details.locked[name] ?? "")) errors.new_value = "That is already what your account says.";
    if (!reason) errors.reason = "Say why it should change, so an admin can check it.";
    if (Object.keys(errors).length) return validationFailed(errors);
    if (details.changeRequests.some((request) => request.field === name && request.status === "pending")) {
      return fail(409, "You already asked to change this detail. An admin is reviewing that request.", { code: "change_request_pending" });
    }
    const request = { id: nextChangeRequestId++, field: name, new_value: value, reason, status: "pending" as const, has_document: field(body, "document") instanceof File, reviewed_at: null, created_at: new Date().toISOString() };
    details.changeRequests.push(request);
    return ok(request, 201);
  }),

  route(
    "GET",
    "/admin/accounts",
    ({ query }) => {
      const tab = query.tab ?? "all";
      if (!["all", "pet", "human", "alumni"].includes(String(tab))) return validationFailed({ tab: "The selected tab is invalid." });
      const search = text(query.q).toLowerCase();
      const rows = ROWS.filter(({ account }) => tab === "all" || (tab === "alumni" ? account.id === 9 : account.role === tab))
        .filter(({ status }) => !query.status || status === query.status)
        .filter(({ account }) => !search || account.display_name.toLowerCase().includes(search) || account.email.includes(search))
        .map(summary);
      return { status: 200, body: paginate(rows, query, "/api/v1/admin/accounts") };
    },
    "admin",
  ),

  route(
    "GET",
    "/admin/accounts/:accountId",
    ({ params }) => {
      const row = findRow(params.accountId);
      return row ? ok(detail(row)) : fail(404, "Account not found.");
    },
    "admin",
  ),

  act("suspend", (status) => status === "active", ["Only an Active account can be suspended.", "cannot_suspend"], "suspended"),
  act("reactivate", (status) => status === "suspended", ["Only a suspended account can be reactivated.", "not_suspended"], "active"),
  act("deactivate", (status) => status !== "deactivated", ["This account is already deactivated.", "already_deactivated"], "deactivated"),

  route(
    "POST",
    "/admin/change-requests/:changeRequestId/review",
    ({ params, body, account }) => {
      const owner = Object.entries(DETAILS).find(([, details]) => details.changeRequests.some((request) => String(request.id) === params.changeRequestId));
      const request = owner?.[1].changeRequests.find((candidate) => String(candidate.id) === params.changeRequestId);
      if (!owner || !request) return fail(404, "Not found.");
      const decision = field(body, "decision");
      if (decision !== "approved" && decision !== "denied") return validationFailed({ decision: "The selected decision is invalid." });
      if (decision === "denied" && !text(field(body, "reason"))) return validationFailed({ reason: "Enter a reason for denying the change. The owner reads it." });
      if (request.status !== "pending") return fail(409, "This change request has already been reviewed.", { code: "already_reviewed" });
      Object.assign(request, { status: decision, reviewed_at: new Date().toISOString() });
      if (decision === "approved") owner[1].locked[request.field] = request.new_value;
      return ok({ ...request, current_value: String(owner[1].locked[request.field] ?? ""), reviewed_by: account?.display_name ?? "admin" });
    },
    "admin",
  ),
];
