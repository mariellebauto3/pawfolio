import { XSRF_COOKIE, XSRF_HEADER, readCookie } from "@/lib/api/cookies";
import { type Transport, baseHeaders, buildApiUrl, encodeBody, isWriteMethod, readBody } from "@/lib/api/core";

// Talks to Laravel from the Next.js server (Server Components, proxy.ts) on behalf of the browser that made the
// request: it forwards that browser's cookies, and sends our own origin so Sanctum treats the call as coming from
// the first-party SPA. Cookies Laravel sets in its answer are not passed back to the browser, so use it to read.

export type ServerTransportDeps = {
  apiUrl: string;
  /** The incoming request's `Cookie` header. */
  cookie: string | null;
  /** This frontend's origin, e.g. http://localhost:3000. Must be in Laravel's SANCTUM_STATEFUL_DOMAINS. */
  origin: string;
  fetch: typeof fetch;
};

export function createServerTransport({ apiUrl, cookie, origin, fetch }: ServerTransportDeps): Transport {
  return async (request) => {
    const headers = baseHeaders();
    headers.set("Origin", origin);
    headers.set("Referer", `${origin}/`);
    if (cookie) headers.set("Cookie", cookie);

    const body = encodeBody(request.body, headers);
    const token = isWriteMethod(request.method) && cookie ? readCookie(cookie, XSRF_COOKIE) : null;
    if (token) headers.set(XSRF_HEADER, token);

    const response = await fetch(buildApiUrl(apiUrl, request.path, request.query), {
      method: request.method,
      headers,
      body,
      signal: request.signal,
      cache: "no-store",
    });

    return {
      status: response.status,
      // A file is handed over as it is; an error is JSON whatever was asked for.
      body: request.responseType === "blob" && response.ok ? await response.blob() : await readBody(response),
      retryAfter: response.headers.get("Retry-After"),
    };
  };
}
