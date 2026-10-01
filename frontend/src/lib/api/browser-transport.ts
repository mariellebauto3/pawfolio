import { XSRF_COOKIE, XSRF_HEADER } from "@/lib/api/cookies";
import { type Transport, type TransportRequest, baseHeaders, buildApiUrl, encodeBody, isWriteMethod, readBody } from "@/lib/api/core";
import { normalizeApiError } from "@/lib/api/errors";

// Talks to Laravel from the browser with Sanctum SPA cookie sessions (SEC-AUTH-01): `credentials: "include"` sends
// the HttpOnly session cookie, and every write carries the CSRF token. No tokens are kept in JavaScript or storage.

export type BrowserTransportDeps = {
  apiUrl: string;
  fetch: typeof fetch;
  readCookie: (name: string) => string | null;
};

export function createBrowserTransport({ apiUrl, fetch, readCookie }: BrowserTransportDeps): Transport {
  // Shared so that several writes starting at once trigger one /sanctum/csrf-cookie call, not one each.
  let pendingCsrf: Promise<void> | null = null;

  function refreshCsrfCookie(): Promise<void> {
    pendingCsrf ??= (async () => {
      try {
        const response = await fetch(`${apiUrl}/sanctum/csrf-cookie`, {
          credentials: "include",
          headers: baseHeaders(),
        });
        if (!response.ok) throw normalizeApiError(response.status, await readBody(response));
      } finally {
        pendingCsrf = null;
      }
    })();
    return pendingCsrf;
  }

  async function send(request: TransportRequest, isRetry: boolean) {
    const isWrite = isWriteMethod(request.method);
    // Sanctum hands out the XSRF-TOKEN cookie from /sanctum/csrf-cookie; fetch it before the first write.
    if (isWrite && !readCookie(XSRF_COOKIE)) await refreshCsrfCookie();

    const headers = baseHeaders();
    const body = encodeBody(request.body, headers);
    const token = isWrite ? readCookie(XSRF_COOKIE) : null;
    if (token) headers.set(XSRF_HEADER, token);

    const response = await fetch(buildApiUrl(apiUrl, request.path, request.query), {
      method: request.method,
      headers,
      body,
      credentials: "include",
      signal: request.signal,
    });

    // 419: the CSRF token no longer matches the session (it expired or the user signed in elsewhere). Get a fresh
    // one and try once more.
    if (response.status === 419 && isWrite && !isRetry) {
      await refreshCsrfCookie();
      return send(request, true);
    }

    return {
      status: response.status,
      body: await readBody(response),
      retryAfter: response.headers.get("Retry-After"),
    };
  }

  return (request) => send(request, false);
}
