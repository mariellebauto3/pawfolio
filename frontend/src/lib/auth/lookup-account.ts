import { env, readSessionCookieName } from "@/config/env";
import { readCookie } from "@/lib/api/cookies";
import { createServerApiClient } from "@/lib/api/server";
import { fetchSession } from "@/lib/auth/session";
import type { Account } from "@/types/account";

const SESSION_LOOKUP_TIMEOUT_MS = 2000;

/**
 * The signed-in account for an incoming request, for code on the Next.js server (proxy.ts, the root layout).
 * Resolves to null when signed out, or undefined when the API couldn't tell us (down, or slower than 2 s): callers
 * then let the request through and the browser asks again. Never throws.
 */
export async function lookUpAccount(cookieHeader: string | null): Promise<Account | null | undefined> {
  // No Laravel session cookie means nobody has signed in from this browser: skip the API call.
  if (env.apiMode === "live" && !(cookieHeader && readCookie(cookieHeader, readSessionCookieName()) !== null)) {
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
