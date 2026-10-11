// Typed access to environment variables. NEXT_PUBLIC_* values are inlined into the browser bundle at build time,
// so they are public by definition and never hold secrets (SEC-FE-03). Each one is read by its full literal name
// (process.env.NEXT_PUBLIC_…), which is what lets Next.js inline it.

export type ApiMode = "live" | "mock";

export type Env = {
  /** Laravel origin, without a trailing slash. API routes live under `${apiUrl}/api/v1`. */
  apiUrl: string;
  /** This frontend's origin. Server-side calls send it as `Origin` so Sanctum treats them as first-party. */
  appUrl: string;
  /** `mock` answers API calls from fixtures in src/lib/api/mock. Development only; production is always `live`. */
  apiMode: ApiMode;
};

export type RawEnv = {
  NEXT_PUBLIC_API_URL?: string;
  NEXT_PUBLIC_APP_URL?: string;
  NEXT_PUBLIC_API_MODE?: string;
  NODE_ENV?: string;
};

const DEFAULT_API_URL = "http://localhost:8000";
const DEFAULT_APP_URL = "http://localhost:3000";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function parseEnv(raw: RawEnv): Env {
  const isProduction = raw.NODE_ENV === "production";
  return {
    apiUrl: parseOrigin("NEXT_PUBLIC_API_URL", raw.NEXT_PUBLIC_API_URL || DEFAULT_API_URL, isProduction),
    appUrl: parseOrigin("NEXT_PUBLIC_APP_URL", raw.NEXT_PUBLIC_APP_URL || DEFAULT_APP_URL, isProduction),
    // Fixtures must never stand in for the real API in a production build.
    apiMode: raw.NEXT_PUBLIC_API_MODE === "mock" && !isProduction ? "mock" : "live",
  };
}

function parseOrigin(name: string, value: string, isProduction: boolean): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute URL such as ${DEFAULT_API_URL}; got "${value}".`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`${name} must use http or https; got "${value}".`);
  }
  // HTTPS everywhere outside local development (SEC-CRYPTO-02).
  if (isProduction && url.protocol === "http:" && !LOCAL_HOSTS.has(url.hostname)) {
    throw new Error(`${name} must use https in production; got "${value}".`);
  }
  return url.origin;
}

export const env: Env = parseEnv({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_API_MODE: process.env.NEXT_PUBLIC_API_MODE,
  NODE_ENV: process.env.NODE_ENV,
});

/**
 * Laravel's session cookie name (backend `SESSION_COOKIE`, default `<app-name>-session`). Server-only: `proxy.ts`
 * uses it to skip the session lookup for visitors who have never had a session. The browser can't read the cookie
 * (it is HttpOnly), so this is never needed client-side.
 */
export function readSessionCookieName(): string {
  return process.env.SESSION_COOKIE_NAME || "pawfolio-session";
}
