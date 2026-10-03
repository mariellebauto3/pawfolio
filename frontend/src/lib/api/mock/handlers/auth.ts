import { MOCK_PASSWORD, findMockPersonaByEmail, resolveMockAccount } from "@/lib/api/mock/personas";
import { type MockRoute, fail, ok, route, validationFailed } from "@/lib/api/mock/router";
import { AUTH_ENDPOINTS } from "@/lib/auth/endpoints";
import { firstPasswordProblem } from "@/lib/auth/password-rules";

// Mirrors docs/api/auth.md and backend/tests/Feature/Auth/. Try it in mock mode:
//   sign in with any persona's email and MOCK_PASSWORD ("password"); jun.reyes@example.com is a closed account;
//   5 wrong passwords for one email lock it for 15 minutes; open /reset-password#token=mock-reset-token&email=…
//   to reset (any other token is "invalid or has expired").

type SignInBody = { email?: unknown; password?: unknown; remember?: unknown };
type ResetBody = { token?: unknown; email?: unknown; password?: unknown; password_confirmation?: unknown };

const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 15 * 60;
const MISMATCH = "That email and password don't match. Try again.";
const SENT = "If an account exists for that email, we've sent a link to reset the password. It expires in 30 minutes.";
const BAD_LINK = "This reset link is invalid or has expired. Ask for a new one.";

/** The token the mock accepts on /reset-password (one at a time, like the real single-use token). */
export const MOCK_RESET_TOKEN = "mock-reset-token";

/** Failed attempts per email, kept for the browser tab's lifetime (the real API keys them on email + IP). */
const failures = new Map<string, { count: number; lockedAt: number | null }>();

/** For tests: forget lockouts between cases. */
export function resetMockSignInAttempts(): void {
  failures.clear();
}

const normalize = (email: string) => email.trim().toLowerCase();
export const isEmail = (value: unknown): value is string => typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export const authRoutes: MockRoute[] = [
  route("GET", AUTH_ENDPOINTS.me, ({ account }) => ok(account), "signed-in"),

  route(
    "POST",
    AUTH_ENDPOINTS.signIn,
    ({ body }) => {
      const { email, password } = (body ?? {}) as SignInBody;
      const errors: Record<string, string> = {};
      if (typeof email !== "string" || !email.trim()) errors.email = "Enter your email.";
      else if (!isEmail(email)) errors.email = "Enter a valid email address.";
      if (typeof password !== "string" || !password) errors.password = "Enter your password.";
      if (Object.keys(errors).length) return validationFailed(errors);

      const key = normalize(email as string);
      const record = failures.get(key);
      if (record?.lockedAt != null) {
        const left = Math.ceil(record.lockedAt / 1000 + LOCKOUT_SECONDS - Date.now() / 1000);
        if (left > 0) {
          return { ...fail(429, "Too many failed attempts. Sign-in is paused for 15 minutes.", { code: "rate_limited" }), retryAfter: left };
        }
        failures.delete(key);
      }

      const persona = findMockPersonaByEmail(key);
      // One generic message whether the email exists or not (SEC-AUTH-05, AU-03).
      if (!persona || password !== MOCK_PASSWORD) {
        const count = (failures.get(key)?.count ?? 0) + 1;
        failures.set(key, { count, lockedAt: count >= MAX_ATTEMPTS ? Date.now() : null });
        return validationFailed({ email: MISMATCH });
      }
      failures.delete(key);

      const account = resolveMockAccount(persona);
      // Told only after the right password, like the API.
      if (account?.status === "deactivated") return validationFailed({ email: "This account was closed." });
      return { ...ok(account), persona };
    },
    "public",
  ),

  // 204 even when already signed out, like the API.
  route("POST", AUTH_ENDPOINTS.signOut, () => ({ status: 204, persona: "signed-out" }), "public"),

  route(
    "POST",
    AUTH_ENDPOINTS.forgotPassword,
    ({ body }) => {
      const { email } = (body ?? {}) as { email?: unknown };
      if (typeof email !== "string" || !email.trim()) return validationFailed({ email: "Enter your email." });
      if (!isEmail(email)) return validationFailed({ email: "Enter a valid email address." });
      // The same answer whether the account exists or not (SEC-AUTH-05).
      return { status: 200, body: { message: SENT } };
    },
    "public",
  ),

  route(
    "POST",
    AUTH_ENDPOINTS.resetPassword,
    ({ body }) => {
      const { token, email, password, password_confirmation: confirmation } = (body ?? {}) as ResetBody;
      if (typeof password !== "string" || !password) return validationFailed({ password: "Enter a new password." });
      const problem = firstPasswordProblem(password);
      if (problem) return validationFailed({ password: problem });
      if (password !== confirmation) return validationFailed({ password: "The passwords don't match." });
      if (token !== MOCK_RESET_TOKEN || !isEmail(email) || !findMockPersonaByEmail(normalize(email))) {
        return validationFailed({ token: BAD_LINK });
      }
      return { status: 200, body: { message: "Your password has been reset. Sign in with your new password." } };
    },
    "public",
  ),

  // Lets screens exercise the 5xx path: GET /api/v1/mock/server-error.
  route("GET", "/mock/server-error", () => fail(500, "SQLSTATE[42S02]: stack trace that must never be shown"), "public"),
];
