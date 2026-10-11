import { XSRF_COOKIE, XSRF_HEADER, readCookie } from "@/lib/api/cookies";
import { type Transport, baseHeaders, buildApiUrl, encodeBody, isWriteMethod, readBody } from "@/lib/api/core";
import { networkError } from "@/lib/api/errors";

// Talks to Laravel from the Next.js server (Server Components, proxy.ts) on behalf of the browser that made the
// request: it forwards that browser's cookies, and sends our own origin so Sanctum treats the call as coming from
// the first-party SPA. Cookies Laravel sets in its answer are not passed back to the browser, so use it to read.

/**
 * How long the Next.js server waits for Laravel to answer one call.
 *
 * Deliberately generous: a page waits for these calls before it paints, and it makes more than one, while the API
 * answers them one at a time — so a call can sit behind others before it is answered at all, and a budget that only
 * covers the call itself turns a healthy API into the "couldn't reach Pawfolio" screen. A fast API never approaches
 * this; it only bounds how long a page is left waiting when the API really is gone.
 */
export const SERVER_CALL_TIMEOUT_MS = 30_000;

export type ServerTransportDeps = {
  apiUrl: string;
  /** The incoming request's `Cookie` header. */
  cookie: string | null;
  /** This frontend's origin, e.g. http://localhost:3000. Must be in Laravel's SANCTUM_STATEFUL_DOMAINS. */
  origin: string;
  fetch: typeof fetch;
  /** Defaults to SERVER_CALL_TIMEOUT_MS. */
  timeoutMs?: number;
};

export function createServerTransport({ apiUrl, cookie, origin, fetch, timeoutMs = SERVER_CALL_TIMEOUT_MS }: ServerTransportDeps): Transport {
  return async (request) => {
    const headers = baseHeaders();
    headers.set("Origin", origin);
    headers.set("Referer", `${origin}/`);
    if (cookie) headers.set("Cookie", cookie);

    const body = encodeBody(request.body, headers);
    const token = isWriteMethod(request.method) && cookie ? readCookie(cookie, XSRF_COOKIE) : null;
    if (token) headers.set(XSRF_HEADER, token);

    // A page waits for these calls before it renders. Without a limit, an API that accepts the connection but never
    // answers would leave the visitor on the loading skeleton for good.
    const timeout = AbortSignal.timeout(timeoutMs);
    let response: Response;
    try {
      response = await fetch(buildApiUrl(apiUrl, request.path, request.query), {
        method: request.method,
        headers,
        body,
        signal: request.signal ? AbortSignal.any([request.signal, timeout]) : timeout,
        cache: "no-store",
      });
    } catch (cause) {
      // No answer in time is the same to the visitor as no answer at all: the page shows "couldn't reach Pawfolio"
      // with Try again. The caller's own cancellation is passed on as it is.
      if (timeout.aborted && !request.signal?.aborted) throw networkError();
      throw cause;
    }

    return {
      status: response.status,
      // A file is handed over as it is; an error is JSON whatever was asked for.
      body: request.responseType === "blob" && response.ok ? await response.blob() : await readBody(response),
      retryAfter: response.headers.get("Retry-After"),
    };
  };
}
