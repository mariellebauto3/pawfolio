import { env } from "@/config/env";
import { createBrowserTransport } from "@/lib/api/browser-transport";
import { readBrowserCookie } from "@/lib/api/cookies";
import { type ApiClient, type ApiErrorListener, createApiClient } from "@/lib/api/core";
import { createMockTransport, writeBrowserMockDecisions, writeBrowserMockPersona } from "@/lib/api/mock/transport";

// The one HTTP client for Laravel in the browser. Use it from client components and feature `api/` folders:
//   const { data } = await api.get<ApiResource<Pet>>(`/pets/${petId}`);
//   await api.post(`/adoption-requests/${id}/approve`, { message });
// Failures throw ApiError (src/lib/api/errors.ts). 401 and account-not-active errors are also reported to the
// listeners below, which the SessionProvider uses to redirect.

const errorListeners = new Set<ApiErrorListener>();

/** Subscribe to API errors from `api` (not the server client). Returns the unsubscribe function. */
export function onApiError(listener: ApiErrorListener): () => void {
  errorListeners.add(listener);
  return () => {
    errorListeners.delete(listener);
  };
}

const transport =
  env.apiMode === "mock"
    ? createMockTransport({
        readCookie: readBrowserCookie,
        writePersona: writeBrowserMockPersona,
        writeDecisions: writeBrowserMockDecisions,
      })
    :// Wrapped so fetch is always called with the global `this`; a detached reference throws "Illegal invocation".
      createBrowserTransport({ apiUrl: env.apiUrl, fetch: (input, init) => fetch(input, init), readCookie: readBrowserCookie });

export const api: ApiClient = createApiClient(transport, {
  onError: (error) =>
    errorListeners.forEach((listener) => {
      // A failing listener must not replace the ApiError the caller is waiting for; report it and carry on.
      try {
        listener(error);
      } catch (listenerError) {
        if (typeof reportError === "function") reportError(listenerError);
        else console.error(listenerError);
      }
    }),
});
