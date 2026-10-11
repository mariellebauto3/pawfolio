import { cookies } from "next/headers";
import { env } from "@/config/env";
import { readCookie } from "@/lib/api/cookies";
import { type ApiClient, createApiClient } from "@/lib/api/core";
import { createMockTransport } from "@/lib/api/mock/transport";
import { createServerTransport } from "@/lib/api/server-transport";

// The API client for code running on the Next.js server. It calls Laravel as the browser that sent the current
// request (its cookies are forwarded). Errors throw ApiError like the browser client; nothing redirects
// automatically, so handle 401 in the caller (e.g. `redirect(signInPath(...))`).

type ServerApiContext = {
  /** The incoming request's `Cookie` header. */
  cookie: string | null;
  /** This frontend's origin, sent as `Origin` so Sanctum treats the call as first-party. */
  origin: string;
};

export function createServerApiClient({ cookie, origin }: ServerApiContext): ApiClient {
  if (env.apiMode === "mock") {
    // No simulated latency on the server: it would slow every navigation through proxy.ts.
    const readRequestCookie = (name: string) => (cookie ? readCookie(cookie, name) : null);
    return createApiClient(createMockTransport({ readCookie: readRequestCookie, latencyMs: 0 }));
  }
  return createApiClient(createServerTransport({ apiUrl: env.apiUrl, cookie, origin, fetch }));
}

/** For Server Components and Route Handlers: an API client acting as the current visitor. */
export async function getServerApi(): Promise<ApiClient> {
  const cookieStore = await cookies();
  return createServerApiClient({ cookie: cookieStore.toString() || null, origin: env.appUrl });
}
