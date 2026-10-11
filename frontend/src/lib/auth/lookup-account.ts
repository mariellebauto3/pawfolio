import { env, readSessionCookieName } from "@/config/env";
import { readCookie } from "@/lib/api/cookies";
import { createServerApiClient } from "@/lib/api/server";
import { SERVER_CALL_TIMEOUT_MS } from "@/lib/api/server-transport";
import { fetchSession } from "@/lib/auth/session";
import type { Account } from "@/types/account";

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
 * The signed-in account for an incoming request, checked before protected navigation in proxy.ts.
 * Use the same timeout as page API calls so ordinary hosted latency does not reject a valid session.
 * Resolves to null when signed out, or undefined when the API couldn't tell us: callers
 * fail closed without rendering the requested page. Never throws.
 *
 * Server Components use renderAccount() instead: it shares one lookup across a whole render and reports failures
 * rather than swallowing them.
 */
export async function lookUpAccount(cookieHeader: string | null, origin: string = env.appUrl): Promise<Account | null | undefined> {
  // No Laravel session cookie means nobody has signed in from this browser: skip the API call.
  if (!needsAccountLookup(cookieHeader)) {
    return null;
  }

  const client = createServerApiClient({ cookie: cookieHeader, origin });
  try {
    return await fetchSession(client, { signal: AbortSignal.timeout(SERVER_CALL_TIMEOUT_MS) });
  } catch (error) {
    // Log only classification, never cookies, account details, response bodies or exception messages.
    const details = error && typeof error === "object" ? error as { name?: unknown; kind?: unknown; status?: unknown } : {};
    console.error("Pawfolio navigation session check failed", {
      name: typeof details.name === "string" ? details.name : "UnknownError",
      kind: typeof details.kind === "string" ? details.kind : "unknown",
      status: typeof details.status === "number" ? details.status : null,
    });
    return undefined;
  }
}
