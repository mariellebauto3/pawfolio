import type { ApiClient } from "@/lib/api/core";
import { ApiError } from "@/lib/api/errors";
import { AUTH_ENDPOINTS } from "@/lib/auth/endpoints";
import { isAccount } from "@/lib/auth/session";
import type { Account } from "@/types/account";
import type { ApiResource } from "@/types/api";

// Sign-in and password calls (docs/api/auth.md). They skip the client's automatic 401 handling: a failed sign-in is
// shown on the form, not turned into a redirect.

export type SignInInput = { email: string; password: string; remember: boolean };

/** Signs in and returns the account. Throws ApiError: 422 `fieldErrors.email` (AU-03), 429 lockout. */
export async function signIn(client: ApiClient, input: SignInInput): Promise<Account> {
  const response = await client.post<ApiResource<unknown>>(AUTH_ENDPOINTS.signIn, input, { skipAuthRedirect: true });
  if (!isAccount(response?.data)) {
    throw new ApiError({ kind: "server", status: 200, message: "We couldn't sign you in. Please try again." });
  }
  return response.data;
}

/** Asks for a reset link. The API answers the same whether the account exists or not (SEC-AUTH-05). */
export async function requestPasswordReset(client: ApiClient, email: string): Promise<void> {
  await client.post(AUTH_ENDPOINTS.forgotPassword, { email }, { skipAuthRedirect: true });
}

export type ResetPasswordInput = { token: string; email: string; password: string; password_confirmation: string };

/** Sets the new password. Throws ApiError: 422 `fieldErrors.password` or `fieldErrors.token` (link invalid/expired). */
export async function resetPassword(client: ApiClient, input: ResetPasswordInput): Promise<void> {
  await client.post(AUTH_ENDPOINTS.resetPassword, input, { skipAuthRedirect: true });
}
