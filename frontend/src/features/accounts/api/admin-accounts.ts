import { type ApiClient, apiPath } from "@/lib/api/core";
import { isRecord, isText, readPage, unexpected } from "@/lib/api/readers";
import { DOCUMENT_FILE_TYPES } from "@/lib/auth/verification-review";
import type { ApiResource, Paginated } from "@/types/api";
import { REPORT_REASONS, REPORT_TARGET_TYPES, type ReportReason, type ReportTargetType } from "@/types/report";
import {
  ACCOUNT_STATUSES,
  type AccountStatus,
  PET_STATUSES,
  type PetStatus,
  REPORT_STATUSES,
  REQUEST_STATUSES,
  type ReportStatus,
  type RequestStatus,
  VERIFICATION_STATUSES,
  type VerificationStatus,
} from "@/types/statuses";
import type { AccountFilters } from "../schemas/accounts";
import {
  ACCOUNT_ACTIONS,
  type AccountActionKind,
  type AccountDetail,
  type AccountSummary,
  type ActivityEntry,
  type AdminChangeRequest,
  type ChangeReviewInput,
} from "../types/accounts";
import { toChangeRequest } from "./settings";

// Accounts as an admin manages them (docs/api/community-reports-and-admin.md, AC-06…AC-10, FR34). The list and an
// account's page are read from Server Components with `getServerApi()`; suspend, reactivate, deactivate and a change
// request's review run in the browser, where the CSRF token is. Who is acting comes from the session, and a status
// is never sent: each action is its own endpoint (FR27). The API checks the admin role on every call and requires
// the reason (SEC-AUTHZ-07), and every path with an id is built with apiPath (SEC-FE-08).

const ACCOUNTS = "/admin/accounts";
const LIST_PROBLEM = "We couldn't load the accounts. Please try again.";
const ACCOUNT_PROBLEM = "We couldn't load this account. Please try again.";
const ACTION_PROBLEM = "We couldn't confirm that. Reload the page to see where the account stands.";

const isId = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value > 0;
const textOrNull = (value: unknown) => (isText(value) && value.trim() !== "" ? value : null);
const isDate = (value: unknown): value is string => isText(value) && !Number.isNaN(new Date(value).getTime());
const dateOrNull = (value: unknown) => (isDate(value) ? value : null);
const oneOf = <T extends string>(list: readonly T[], value: unknown): value is T => (list as readonly unknown[]).includes(value);
const countOf = (value: unknown) => (typeof value === "number" && value > 0 ? Math.floor(value) : 0);
const rows = <T>(value: unknown, read: (row: unknown) => T | null): T[] => (Array.isArray(value) ? value.flatMap((row) => read(row) ?? []) : []);

/**
 * An account as the admin screens read it, or null when it doesn't match the contract and isn't shown. The screens
 * pick their badge and their actions from `status`, so it is never guessed.
 */
export function toAccountSummary(row: unknown): AccountSummary | null {
  if (!isRecord(row) || !isId(row.id) || (row.role !== "pet" && row.role !== "human") || !oneOf<AccountStatus>(ACCOUNT_STATUSES, row.status) || !isText(row.display_name) || !isDate(row.created_at)) {
    return null;
  }
  const pet = isRecord(row.pet) && isId(row.pet.id) ? row.pet : null;
  const home = isRecord(row.home_profile) && isId(row.home_profile.id) ? row.home_profile : null;
  const adoption = isRecord(row.adoption) && isId(row.adoption.id) ? row.adoption : null;
  return {
    id: row.id,
    role: row.role,
    status: row.status,
    email: isText(row.email) ? row.email : "",
    display_name: row.display_name,
    avatar_url: textOrNull(row.avatar_url),
    profile_id: isId(row.profile_id) ? row.profile_id : null,
    pet: pet && {
      id: pet.id as number,
      name: isText(pet.name) ? pet.name : row.display_name,
      city: textOrNull(pet.city),
      status: oneOf<PetStatus>(PET_STATUSES, pet.status) ? pet.status : null,
      photo_url: textOrNull(pet.photo_url),
    },
    home_profile: home && {
      id: home.id as number,
      full_name: isText(home.full_name) ? home.full_name : row.display_name,
      city: textOrNull(home.city),
      profile_photo_url: textOrNull(home.profile_photo_url),
      is_furparent: home.is_furparent === true,
    },
    caretaker_name: textOrNull(row.caretaker_name),
    adoption: adoption && { id: adoption.id as number, furparent_name: textOrNull(adoption.furparent_name), adopted_at: dateOrNull(adoption.adopted_at) },
    created_at: row.created_at,
  };
}

function toAdminChangeRequest(row: unknown): AdminChangeRequest | null {
  const request = toChangeRequest(row);
  if (!request || !isRecord(row)) return null;
  const current = isText(row.current_value) ? row.current_value : typeof row.current_value === "number" ? String(row.current_value) : null;
  return { ...request, current_value: current, reviewed_by: textOrNull(row.reviewed_by) };
}

function toActivity(row: unknown): ActivityEntry | null {
  if (!isRecord(row) || !isId(row.id) || !isText(row.action) || !isDate(row.created_at)) return null;
  return { id: row.id, type: isText(row.type) ? row.type : "", action: row.action, before_value: textOrNull(row.before_value), after_value: textOrNull(row.after_value), reason: textOrNull(row.reason), created_at: row.created_at };
}

function readDetail(response: ApiResource<unknown> | null | undefined): AccountDetail {
  const data = response?.data;
  const summary = toAccountSummary(data);
  if (!summary || !isRecord(data)) throw unexpected(ACCOUNT_PROBLEM);
  const verification = isRecord(data.verification) && oneOf<VerificationStatus>(VERIFICATION_STATUSES, data.verification.status) ? data.verification : null;
  const reports = isRecord(data.reports_against) ? data.reports_against : {};

  return {
    ...summary,
    account_actions: rows(data.account_actions, (row) =>
      isRecord(row) && isId(row.id) && oneOf<AccountActionKind>(ACCOUNT_ACTIONS, row.action) && isDate(row.created_at)
        ? { id: row.id, action: row.action, reason: textOrNull(row.reason), performed_by: textOrNull(row.performed_by), by_owner: row.by_owner === true, created_at: row.created_at }
        : null,
    ),
    verification: verification && {
      status: verification.status as VerificationStatus,
      submitted_at: dateOrNull(verification.submitted_at),
      reviewed_at: dateOrNull(verification.reviewed_at),
      reviewed_by: textOrNull(verification.reviewed_by),
      documents: rows(verification.documents, (row) => (isRecord(row) && isId(row.id) && isText(row.type) ? { id: row.id, type: row.type } : null)),
    },
    requests: rows(data.requests, (row) =>
      isRecord(row) && isId(row.id) && oneOf<RequestStatus>(REQUEST_STATUSES, row.status) && isDate(row.created_at)
        ? { id: row.id, pet_name: textOrNull(row.pet_name), home_name: textOrNull(row.home_name), status: row.status, created_at: row.created_at }
        : null,
    ),
    reports_against: {
      total: countOf(reports.total),
      open: countOf(reports.open),
      latest: rows(reports.latest, (row) =>
        isRecord(row) && isId(row.id) && oneOf<ReportTargetType>(REPORT_TARGET_TYPES, row.target_type) && oneOf<ReportReason>(REPORT_REASONS, row.reason) && oneOf<ReportStatus>(REPORT_STATUSES, row.status) && isDate(row.created_at)
          ? { id: row.id, target_type: row.target_type, reason: row.reason, status: row.status, created_at: row.created_at }
          : null,
      ),
    },
    detail_change_requests: rows(data.detail_change_requests, toAdminChangeRequest),
    recent_activity: rows(data.recent_activity, toActivity),
  };
}

/** Pet and Human accounts, newest first, a page at a time (AC-06). The Alumni tab lists adopted pets. */
export async function getAccounts(client: ApiClient, filters: Partial<AccountFilters> & { page?: number; perPage?: number } = {}): Promise<Paginated<AccountSummary>> {
  const { tab, status, search, page, perPage } = filters;
  const response = await client.get<unknown>(ACCOUNTS, { query: { tab: tab === "all" ? undefined : tab, status, q: search || undefined, page, per_page: perPage } });
  if (!isRecord(response) || !Array.isArray(response.data)) throw unexpected(LIST_PROBLEM);
  return readPage({ ...response, data: response.data.map(toAccountSummary) }, (row): row is AccountSummary => row !== null, LIST_PROBLEM);
}

/** One account with its history, requests, verification, reports and change requests (AC-07). 404 for an admin's id. */
export async function getAccount(client: ApiClient, accountId: number): Promise<AccountDetail> {
  return readDetail(await client.get<ApiResource<unknown>>(apiPath`/admin/accounts/${accountId}`));
}

async function act(client: ApiClient, accountId: number, action: AccountActionKind, reason: string): Promise<AccountSummary> {
  const response = await client.post<ApiResource<unknown>>(apiPath`/admin/accounts/${accountId}/${action}`, { reason });
  const account = toAccountSummary(response?.data);
  if (!account) throw unexpected(ACTION_PROBLEM);
  return account;
}

/**
 * Suspends an Active account (AC-08): the owner is signed out everywhere and reads the reason on their Suspended
 * screen, and open requests are closed. Throws ApiError: 422 `fieldErrors.reason`; 409 when it is no longer Active.
 */
export const suspendAccount = (client: ApiClient, accountId: number, reason: string) => act(client, accountId, "suspend", reason);

/** Makes a suspended account Active again (AC-09), with a note for the log. 409 when it isn't suspended. */
export const reactivateAccount = (client: ApiClient, accountId: number, reason: string) => act(client, accountId, "reactivate", reason);

/** Removes an account while keeping its records (AC-10). 409 when it is already deactivated. */
export const deactivateAccount = (client: ApiClient, accountId: number, reason: string) => act(client, accountId, "deactivate", reason);

/**
 * Approves or denies a change to a locked detail (AC-03). An approval writes the new value; a denial needs its
 * reason, which the owner reads. Throws ApiError: 422 `fieldErrors.reason`; 409 `already_reviewed`.
 */
export async function reviewChangeRequest(client: ApiClient, changeRequestId: number, input: ChangeReviewInput): Promise<AdminChangeRequest> {
  const response = await client.post<ApiResource<unknown>>(apiPath`/admin/change-requests/${changeRequestId}/review`, { decision: input.decision, reason: input.reason?.trim() || undefined });
  const request = toAdminChangeRequest(response?.data);
  if (!request) throw unexpected(ACTION_PROBLEM);
  return request;
}

/**
 * A change request's supporting document, read with the admin's session and held in memory: there is no address for
 * it to be copied, cached or leaked from (SEC-PRIV-01). Only a JPG, PNG or PDF comes back; anything else is refused
 * (SEC-FE-09).
 */
export function getChangeRequestDocument(client: ApiClient, changeRequestId: number, signal?: AbortSignal): Promise<Blob> {
  return client.getFile(apiPath`/admin/change-requests/${changeRequestId}/document`, { accept: DOCUMENT_FILE_TYPES, signal });
}
