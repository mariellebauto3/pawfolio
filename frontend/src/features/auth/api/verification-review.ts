import { type ApiClient, apiPath } from "@/lib/api/core";
import { ApiError } from "@/lib/api/errors";
import { DOCUMENT_FILE_TYPES } from "@/lib/auth/verification-review";
import type { ApiResource, Paginated } from "@/types/api";
import { VERIFICATION_STATUSES } from "@/types/statuses";
import type { DenialInput, VerificationQueueItem, VerificationReview, VerifiedRole } from "@/types/verification-review";

// Admin verification calls (docs/api/auth.md, AU-22…AU-26, FR33). The reads work from Server Components with
// `getServerApi()`; approve, deny and the document files run in the browser, where the CSRF token and the admin's
// session are. Every path with an id is built with apiPath (SEC-FE-08).

const QUEUE = "/admin/verifications";

const unexpected = (message: string) => new ApiError({ kind: "server", status: 200, message });

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

export type QueueFilters = {
  /** Leave out for every account type. */
  role?: VerifiedRole;
  /** Part of the pet's name, the human's full name or the caretaker's name. */
  search?: string;
  page?: number;
  perPage?: number;
};

/** The accounts waiting for review, newest first, a page at a time (AU-22). */
export async function getVerificationQueue(client: ApiClient, filters: QueueFilters = {}): Promise<Paginated<VerificationQueueItem>> {
  const { role, search, page, perPage } = filters;
  const response = await client.get<unknown>(QUEUE, { query: { role, search: search || undefined, page, per_page: perPage } });
  if (!isRecord(response) || !Array.isArray(response.data) || !isRecord(response.meta) || typeof response.meta.total !== "number") {
    throw unexpected("We couldn't load the verification queue. Please try again.");
  }
  return response as Paginated<VerificationQueueItem>;
}

/** How many accounts are waiting. One row is asked for; the count comes with it. */
export async function getVerificationQueueSize(client: ApiClient): Promise<number> {
  return (await getVerificationQueue(client, { perPage: 1 })).meta.total;
}

function readReview(response: ApiResource<unknown> | null | undefined, problem: string): VerificationReview {
  const data = response?.data;
  // The screen picks its actions from `status`, so an answer that doesn't match docs/api/auth.md isn't trusted.
  if (
    !isRecord(data) ||
    !(VERIFICATION_STATUSES as readonly unknown[]).includes(data.status) ||
    !isRecord(data.details) ||
    !Array.isArray(data.documents) ||
    !isRecord(data.queue)
  ) {
    throw unexpected(problem);
  }
  return data as VerificationReview;
}

/** One account's latest submission, to review or to look back on (AU-23, AU-24). 404 when there is none. */
export async function getVerificationReview(client: ApiClient, accountId: number): Promise<VerificationReview> {
  const response = await client.get<ApiResource<unknown>>(apiPath`/admin/verifications/${accountId}`);
  return readReview(response, "We couldn't load this account. Please try again.");
}

/**
 * Approves the pending submission: the account becomes Active (AU-26). Throws ApiError: 409 when another admin
 * already decided, 404 when the account is gone.
 */
export async function approveVerification(client: ApiClient, accountId: number): Promise<VerificationReview> {
  const response = await client.post<ApiResource<unknown>>(apiPath`/admin/verifications/${accountId}/approve`);
  return readReview(response, "We couldn't confirm the approval. Reload the page to see where the account stands.");
}

/**
 * Denies the pending submission with the reason the owner will see (AU-25, AU-20). Throws ApiError: 422
 * `fieldErrors` for `denial_reason` and `message_to_owner`, 409 when another admin already decided.
 */
export async function denyVerification(client: ApiClient, accountId: number, input: DenialInput): Promise<VerificationReview> {
  const response = await client.post<ApiResource<unknown>>(apiPath`/admin/verifications/${accountId}/deny`, input);
  return readReview(response, "We couldn't confirm the denial. Reload the page to see where the account stands.");
}

/**
 * A submitted document's file, read with the admin's session and held in memory: there is no address for it to be
 * copied, cached or leaked from (SEC-PRIV-01). Only a JPG, PNG or PDF comes back; anything else is refused
 * (SEC-FE-09).
 */
export function getVerificationDocument(client: ApiClient, accountId: number, documentId: number, signal?: AbortSignal): Promise<Blob> {
  return client.getFile(apiPath`/admin/verifications/${accountId}/documents/${documentId}`, { accept: DOCUMENT_FILE_TYPES, signal });
}
