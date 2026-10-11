import type { ApiClient } from "@/lib/api/core";
import { ApiError } from "@/lib/api/errors";
import { AUTH_ENDPOINTS } from "@/lib/auth/endpoints";
import { isAccount } from "@/lib/auth/session";
import type { Account } from "@/types/account";
import type { AccountStatusInfo, Submission } from "@/types/account-status";
import type { ApiResource } from "@/types/api";
import { ACCOUNT_STATUSES } from "@/types/statuses";

// Account-status calls (docs/api/auth.md, AU-18…AU-21). The two reads work from Server Components with
// `getServerApi()`; the save runs in the browser, where the CSRF token is.

const unexpected = (message: string) => new ApiError({ kind: "server", status: 200, message });

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

/** Why the account isn't Active, and what was last sent for review. Any signed-in account may ask. */
export async function getAccountStatus(client: ApiClient): Promise<AccountStatusInfo> {
  const response = await client.get<ApiResource<unknown>>(AUTH_ENDPOINTS.accountStatus);
  const data = response?.data;
  // The screen is chosen from `status`, so an answer that doesn't match docs/api/auth.md isn't trusted.
  if (!isRecord(data) || !(ACCOUNT_STATUSES as readonly unknown[]).includes(data.status) || !Array.isArray(data.documents)) {
    throw unexpected("We couldn't load your account status. Please try again.");
  }
  return data as AccountStatusInfo;
}

/** The details the owner submitted, to fill the edit form (AU-19). 403 unless the account is Pending or Denied. */
export async function getSubmission(client: ApiClient): Promise<Submission> {
  const response = await client.get<ApiResource<unknown>>(AUTH_ENDPOINTS.submission);
  const data = response?.data;
  if (!isRecord(data) || (data.role !== "pet" && data.role !== "human") || !Array.isArray(data.documents)) {
    throw unexpected("We couldn't load your details. Please try again.");
  }
  return data as Submission;
}

/**
 * Saves the edited details and puts the account back in the review queue as Pending Verification (FR2, FR19). Build
 * the body with toPetSubmissionForm / toHumanSubmissionForm. Throws ApiError: 422 `fieldErrors` by field, 403 when
 * the account can no longer edit, 413 for an upload the server won't take, 429 when rate limited.
 */
export async function updateSubmission(client: ApiClient, form: FormData): Promise<Account> {
  // PHP reads a multipart body only on POST, so the PATCH travels as POST with Laravel's `_method` field.
  form.set("_method", "PATCH");
  const response = await client.post<ApiResource<unknown>>(AUTH_ENDPOINTS.submission, form);
  if (!isAccount(response?.data)) throw unexpected("We couldn't save your details. Please try again.");
  return response.data;
}
