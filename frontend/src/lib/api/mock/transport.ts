import type { Transport } from "@/lib/api/core";
import type { MockPersonaId } from "@/lib/api/mock/personas";

// Answers API calls from fixtures instead of Laravel (NEXT_PUBLIC_API_MODE=mock, development only). The handlers and
// fixtures are loaded on first use, so live builds never download them.

const MOCK_LATENCY_MS = 250;

/** Which persona the mock session is signed in as (see src/lib/api/mock/personas.ts). */
export const MOCK_PERSONA_COOKIE = "pf_mock_persona";

/** The accounts the mock admin approved or denied (see src/lib/api/mock/decisions.ts). */
export const MOCK_DECISIONS_COOKIE = "pf_mock_decisions";

export type MockTransportDeps = {
  readCookie: (name: string) => string | null;
  /** Remembers a persona change (sign-in, sign-out). Only the browser can; server calls leave it out. */
  writePersona?: (persona: MockPersonaId) => void;
  /** Remembers the admin's decisions, already encoded for the cookie. Only the browser can, like `writePersona`. */
  writeDecisions?: (encoded: string) => void;
  latencyMs?: number;
};

export function createMockTransport({
  readCookie,
  writePersona,
  writeDecisions,
  latencyMs = MOCK_LATENCY_MS,
}: MockTransportDeps): Transport {
  return async (request) => {
    const [{ MOCK_ROUTES }, { dispatch }, { resolveMockAccount }, { parseMockDecisions, encodeMockDecisions, withMockDecision }] =
      await Promise.all([
        import("@/lib/api/mock/handlers"),
        import("@/lib/api/mock/router"),
        import("@/lib/api/mock/personas"),
        import("@/lib/api/mock/decisions"),
      ]);
    // A little latency so loading states show up while building screens.
    await wait(latencyMs, request.signal);

    // Round-trip the body through JSON like a real request, so handlers never share objects with the caller.
    const body = request.body instanceof FormData || request.body === undefined ? request.body : clone(request.body);
    const decisions = parseMockDecisions(readCookie(MOCK_DECISIONS_COOKIE));
    const account = withMockDecision(resolveMockAccount(readCookie(MOCK_PERSONA_COOKIE)), decisions);
    const result = dispatch(MOCK_ROUTES, { ...request, body }, account, decisions);
    if (result.persona) writePersona?.(result.persona);
    if (result.decisions) writeDecisions?.(encodeMockDecisions(result.decisions));

    return {
      status: result.status,
      body: result.file ? new Blob([result.file.bytes], { type: result.file.type }) : result.body === undefined ? null : clone(result.body),
      retryAfter: result.retryAfter === undefined ? null : String(result.retryAfter),
    };
  };
}

export function writeBrowserMockPersona(persona: MockPersonaId): void {
  document.cookie = `${MOCK_PERSONA_COOKIE}=${persona}; path=/; SameSite=Lax`;
}

export function writeBrowserMockDecisions(encoded: string): void {
  document.cookie = `${MOCK_DECISIONS_COOKIE}=${encodeURIComponent(encoded)}; path=/; SameSite=Lax`;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return signal?.aborted ? Promise.reject(abortError()) : Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(abortError());
      },
      { once: true },
    );
  });
}

function abortError(): DOMException {
  return new DOMException("The request was aborted.", "AbortError");
}
