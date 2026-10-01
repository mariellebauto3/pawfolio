import type { HttpMethod, Query } from "@/lib/api/core";
import { ACCOUNT_NOT_ACTIVE_CODE } from "@/lib/api/errors";
import type { MockPersonaId } from "@/lib/api/mock/personas";
import type { Account } from "@/types/account";
import type { Paginated } from "@/types/api";

// Tiny router for mock handlers. Routes enforce the same gates as the real API middleware (signed in, Active,
// admin role), so screens built on mocks already handle 401 and 403 the way they will against Laravel.

/** `public`: anyone. `member`: signed in and Active (SEC-AUTHZ-06). `admin`: Active admin. `signed-in`: any status. */
export type MockAccess = "public" | "signed-in" | "member" | "admin";

export type MockContext = {
  params: Record<string, string>;
  query: Query;
  body: unknown;
  account: Account | null;
};

export type MockResult = {
  status: number;
  body?: unknown;
  /** Switch the mock session, e.g. after sign-in or sign-out. */
  persona?: MockPersonaId;
};

export type MockRoute = {
  method: HttpMethod;
  /** Path under /api/v1 with `:named` params, e.g. "/pets/:petId". */
  pattern: string;
  access: MockAccess;
  handler: (context: MockContext) => MockResult;
};

export function route(
  method: HttpMethod,
  pattern: string,
  handler: MockRoute["handler"],
  access: MockAccess = "member",
): MockRoute {
  return { method, pattern, access, handler };
}

export function matchPath(pattern: string, path: string): Record<string, string> | null {
  const patternParts = pattern.split("/").filter(Boolean);
  const pathParts = path.split("/").filter(Boolean);
  if (patternParts.length !== pathParts.length) return null;
  const params: Record<string, string> = {};
  for (const [index, part] of patternParts.entries()) {
    const actual = pathParts[index];
    if (part.startsWith(":")) {
      try {
        params[part.slice(1)] = decodeURIComponent(actual);
      } catch {
        return null; // malformed %-escape: no route matches, so the request gets a 404 like a real API would give
      }
    } else if (part !== actual) return null;
  }
  return params;
}

/** Answers the request with the first matching route, applying its access gate first. */
export function dispatch(
  routes: readonly MockRoute[],
  request: { method: HttpMethod; path: string; query?: Query; body?: unknown },
  account: Account | null,
): MockResult {
  for (const candidate of routes) {
    if (candidate.method !== request.method) continue;
    const params = matchPath(candidate.pattern, request.path);
    if (!params) continue;
    const denied = checkAccess(candidate.access, account);
    if (denied) return denied;
    return candidate.handler({ params, query: request.query ?? {}, body: request.body, account });
  }
  return fail(404, `No mock for ${request.method} ${request.path} yet. Add one in src/lib/api/mock/handlers/.`);
}

function checkAccess(access: MockAccess, account: Account | null): MockResult | null {
  if (access === "public") return null;
  if (!account) return fail(401, "Unauthenticated.");
  if (access === "signed-in") return null;
  if (account.status !== "active") {
    return fail(403, "Your account isn't active yet.", { code: ACCOUNT_NOT_ACTIVE_CODE });
  }
  if (access === "admin" && account.role !== "admin") return fail(403, "This page is for admins only.");
  return null;
}

export function ok<T>(data: T, status = 200): MockResult {
  return { status, body: { data } };
}

export function fail(status: number, message: string, extra: Record<string, unknown> = {}): MockResult {
  return { status, body: { message, ...extra } };
}

export function validationFailed(errors: Record<string, string>): MockResult {
  const fieldErrors = Object.fromEntries(Object.entries(errors).map(([field, message]) => [field, [message]]));
  return { status: 422, body: { message: "The given data was invalid.", errors: fieldErrors } };
}

const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 50;

/** Laravel's paginated resource shape (SEC-API-05: default 20, max 50 per page). */
export function paginate<T>(items: readonly T[], query: Query, path: string): Paginated<T> {
  const perPage = clamp(Number(query.per_page) || DEFAULT_PER_PAGE, 1, MAX_PER_PAGE);
  const lastPage = Math.max(1, Math.ceil(items.length / perPage));
  const page = clamp(Number(query.page) || 1, 1, lastPage);
  const start = (page - 1) * perPage;
  const data = items.slice(start, start + perPage);
  const url = (n: number) => `${path}?page=${n}`;
  return {
    data,
    meta: {
      current_page: page,
      last_page: lastPage,
      per_page: perPage,
      total: items.length,
      from: data.length ? start + 1 : null,
      to: data.length ? start + data.length : null,
      path,
    },
    links: {
      first: url(1),
      last: url(lastPage),
      prev: page > 1 ? url(page - 1) : null,
      next: page < lastPage ? url(page + 1) : null,
    },
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(Math.trunc(value), min), max);
}
