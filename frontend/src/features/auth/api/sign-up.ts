import type { ApiClient } from "@/lib/api/core";
import { ApiError } from "@/lib/api/errors";
import { AUTH_ENDPOINTS } from "@/lib/auth/endpoints";
import { isAccount } from "@/lib/auth/session";
import type { Account } from "@/types/account";
import type { ApiResource } from "@/types/api";

// Sign-up calls (docs/api/auth.md, AU-12 and AU-17). The body is multipart because it carries the ID and photos;
// build it with toPetSignUpForm / toHumanSignUpForm. Like sign-in, they skip the client's automatic 401 handling.

async function signUp(client: ApiClient, path: string, form: FormData): Promise<Account> {
  const response = await client.post<ApiResource<unknown>>(path, form, { skipAuthRedirect: true });
  if (!isAccount(response?.data)) {
    throw new ApiError({ kind: "server", status: 201, message: "We couldn't create your account. Please try again." });
  }
  return response.data;
}

/**
 * Creates a pet account, Pending Verification and signed in (FR18). Throws ApiError: 422 `fieldErrors` by field
 * (`photos.0` for one photo), 413 for an upload the server won't take, 429 when sign-ups are rate limited.
 */
export function signUpPet(client: ApiClient, form: FormData): Promise<Account> {
  return signUp(client, AUTH_ENDPOINTS.signUpPet, form);
}

/** Creates a human account, Pending Verification and signed in (FR1). Same errors as `signUpPet`. */
export function signUpHuman(client: ApiClient, form: FormData): Promise<Account> {
  return signUp(client, AUTH_ENDPOINTS.signUpHuman, form);
}
