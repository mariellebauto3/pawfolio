import { env, readSessionCookieName } from "@/config/env";
import { readCookie } from "@/lib/api/cookies";
import { createServerApiClient } from "@/lib/api/server";
import { fetchSession } from "@/lib/auth/session";
import type { Account } from "@/types/account";

const SESSION_LOOKUP_TIMEOUT_MS = 2000;

/**
 * Whether knowing who the visitor is takes an API call. False when the browser holds no Laravel session cookie:
 * nobody has signed in from it, so the answer is already known. Mock mode always asks, since there is no session
 * behind the fixtures.
 */
export function needsAccountLookup(cookieHeader: string | null): boolean {
  if (env.apiMode !== "live") return true;
  return cookieHeader !== null && readCookie(cookieHeader, readSessionCookieName()) !== null;
}

/**
 * The signed-in account for an incoming request, for the optimistic redirects in proxy.ts, where an answer that takes
 * too long is worth less than not waiting for it.
 * Resolves to null when signed out, or undefined when the API couldn't tell us (down, or slower than 2 s): callers
 * then let the request through and the browser asks again. Never throws.
 *
 * Server Components use renderAccount() instead: it shares one lookup across a whole render and reports failures
 * rather than swallowing them.
 */
export async function lookUpAccount(cookieHeader: string | null): Promise<Account | null | undefined> {
  // No Laravel session cookie means nobody has signed in from this browser: skip the API call.
  if (!needsAccountLookup(cookieHeader)) {
    return null;
  }

  // The configured origin, not the request's: behind a reverse proxy that can be an internal address that Sanctum
  // doesn't recognise as our SPA, which would make every signed-in visitor look signed out.
  const client = createServerApiClient({ cookie: cookieHeader, origin: env.appUrl });
  try {
    return await fetchSession(client, { signal: AbortSignal.timeout(SESSION_LOOKUP_TIMEOUT_MS) });
  } catch {
    return undefined;
  }
}
