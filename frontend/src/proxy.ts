import { type NextRequest, NextResponse } from "next/server";
import { env, readSessionCookieName } from "@/config/env";
import { createServerApiClient } from "@/lib/api/server";
import { routeArea, routeRedirect } from "@/lib/auth/redirects";
import { fetchSession } from "@/lib/auth/session";
import type { Account } from "@/types/account";

// Optimistic redirects only (SEC-FE-06): signed out → /sign-in, not Active → /account-status, not an admin → away
// from /admin. This is never the access check — every page's data comes from the API, which enforces the same rules
// on its own. If the API can't be asked, the request goes through and the page handles what the API answers.

const SESSION_LOOKUP_TIMEOUT_MS = 2000;

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (routeArea(pathname) === "public") return NextResponse.next();

  const account = await lookUpAccount(request);
  if (account === undefined) return NextResponse.next();

  const target = routeRedirect(`${pathname}${search}`, account);
  return target ? NextResponse.redirect(new URL(target, request.url)) : NextResponse.next();
}

/** The signed-in account, null when signed out, or undefined when the API couldn't tell us. */
async function lookUpAccount(request: NextRequest): Promise<Account | null | undefined> {
  // No Laravel session cookie means nobody has signed in from this browser: skip the API call.
  if (env.apiMode === "live" && !request.cookies.has(readSessionCookieName())) return null;

  // The configured origin, not request.nextUrl.origin: behind a reverse proxy the latter can be an internal address
  // that Sanctum doesn't recognise as our SPA, which would make every signed-in visitor look signed out.
  const client = createServerApiClient({ cookie: request.headers.get("cookie"), origin: env.appUrl });
  try {
    return await fetchSession(client, { signal: AbortSignal.timeout(SESSION_LOOKUP_TIMEOUT_MS) });
  } catch {
    return undefined;
  }
}

export const config = {
  // Pages only: skip Next.js internals and files with an extension (images, icons, fonts).
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};
