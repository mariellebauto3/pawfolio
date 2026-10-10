import {
  ACCOUNT_STATUS_ROUTE_PREFIXES,
  ADMIN_ROUTE_PREFIX,
  MEMBER_ROUTE_PREFIXES,
  NEXT_PATH_PARAM,
  ROUTES,
} from "@/constants/routes";
import type { ApiError } from "@/lib/api/errors";
import type { Account } from "@/types/account";

// Where a visitor belongs, as pure functions shared by proxy.ts and the SessionProvider. These redirects are a
// convenience (SEC-FE-06): the API refuses the same things on its own, whatever the frontend does.

export type RouteArea = "public" | "member" | "admin" | "account-status";

export function routeArea(pathname: string): RouteArea {
  pathname = pathOnly(pathname);
  if (startsWithSegment(pathname, ADMIN_ROUTE_PREFIX)) return "admin";
  if (ACCOUNT_STATUS_ROUTE_PREFIXES.some((prefix) => startsWithSegment(pathname, prefix))) return "account-status";
  if (MEMBER_ROUTE_PREFIXES.some((prefix) => startsWithSegment(pathname, prefix))) return "member";
  return "public";
}

/** Redirect before rendering a page the current account cannot open. */
export function routeRedirect(path: string, account: Account | null): string | null {
  const pathname = pathOnly(path);
  const area = routeArea(pathname);
  if (pathname === ROUTES.landing || pathname === ROUTES.adminsOnly) {
    return account ? homePathFor(account) : pathname === ROUTES.adminsOnly ? ROUTES.signIn : null;
  }
  if (area === "public") return null;
  if (!account) return signInPath(path);
  if (area === "account-status") return null;
  if (account.status !== "active") return ROUTES.accountStatus;
  if (area === "admin" && account.role !== "admin") return homePathFor(account);
  if (area === "member") {
    if (account.role === "admin") return homePathFor(account);
    const petOnly = ["/resume", ROUTES.invites, "/apply"];
    const humanOnly = ["/home-profile", ROUTES.availability];
    if (petOnly.some((prefix) => startsWithSegment(pathname, prefix)) && account.role !== "pet") return homePathFor(account);
    if (humanOnly.some((prefix) => startsWithSegment(pathname, prefix)) && account.role !== "human") return homePathFor(account);
  }
  return null;
}

/** Where an API error should send the user, or null when the screen should show it instead. */
export function errorRedirect(error: ApiError, currentPath: string): string | null {
  const area = routeArea(pathOnly(currentPath));
  if (error.kind === "unauthenticated" && area !== "public") return signInPath(currentPath);
  if (error.kind === "account_not_active" && area !== "account-status") return ROUTES.accountStatus;
  return null;
}

/** Every successful sign-in opens the account's own dashboard. */
export function afterSignInPath(account: Account, _next: string | null | undefined): string {
  // Keep existing callers compatible, but never let a requested module override the dashboard.
  void _next;
  return homePathFor(account);
}

export function homePathFor(account: Account): string {
  if (account.status !== "active") return ROUTES.accountStatus;
  return account.role === "admin" ? ROUTES.adminHome : ROUTES.memberHome;
}

/** `/sign-in?next=<path>`, leaving out `next` when it would be pointless or unsafe. */
export function signInPath(next?: string | null): string {
  const safe = safeNextPath(next);
  if (!safe || routeArea(pathOnly(safe)) === "public") return ROUTES.signIn;
  return `${ROUTES.signIn}?${new URLSearchParams({ [NEXT_PATH_PARAM]: safe })}`;
}

/**
 * Accepts `next` only if it is a path on this site, so the sign-in page can't be used to send people to another
 * site after they sign in (open redirect, SEC-FE-07). Returns null for anything else.
 */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/")) return null;
  // "//evil.com" and "/\evil.com" are read by browsers as another host; control characters can smuggle either in.
  if (next.startsWith("//") || [...next].some((char) => char < " " || char === "\u007f" || char === "\\")) return null;
  try {
    const url = new URL(next, "http://pawfolio.invalid");
    if (url.origin !== "http://pawfolio.invalid") return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

function pathOnly(path: string): string {
  const end = path.search(/[?#]/);
  const pathname = end === -1 ? path : path.slice(0, end);
  try {
    return decodeURIComponent(pathname).replace(/\/+$/, "") || "/";
  } catch {
    return pathname;
  }
}

function startsWithSegment(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}
