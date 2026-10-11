import type { ApiClient, RequestOptions } from "@/lib/api/core";
import { ApiError, isApiError } from "@/lib/api/errors";
import { AUTH_ENDPOINTS } from "@/lib/auth/endpoints";
import type { Account } from "@/types/account";
import type { ApiResource } from "@/types/api";
import { ACCOUNT_STATUSES, ROLES } from "@/types/statuses";

/**
 * Loads the signed-in account. Resolves to null when signed out (401); any other failure throws ApiError, because
 * "we couldn't check" is not the same as "signed out".
 */
export async function fetchSession(client: ApiClient, options: Pick<RequestOptions, "signal"> = {}): Promise<Account | null> {
  let response: ApiResource<unknown>;
  try {
    response = await client.get<ApiResource<unknown>>(AUTH_ENDPOINTS.me, { ...options, skipAuthRedirect: true });
  } catch (error) {
    if (isApiError(error) && error.kind === "unauthenticated") return null;
    throw error;
  }
  // Redirects and the UI decide on role and status, so a response that doesn't match docs/api/auth.md counts as
  // "couldn't check" rather than being trusted.
  if (!isAccount(response?.data)) {
    throw new ApiError({ kind: "server", status: 200, message: "We couldn't load your account. Please try again." });
  }
  return response.data;
}

/** Whether an API payload is an Account as docs/api/auth.md describes it (role and status checked against the enums). */
export function isAccount(value: unknown): value is Account {
  if (typeof value !== "object" || value === null) return false;
  const { id, role, status } = value as Record<string, unknown>;
  return (
    typeof id === "number" &&
    (ROLES as readonly unknown[]).includes(role) &&
    (ACCOUNT_STATUSES as readonly unknown[]).includes(status)
  );
}
