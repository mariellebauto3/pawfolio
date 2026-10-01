import { MOCK_PASSWORD, findMockPersonaByEmail, resolveMockAccount } from "@/lib/api/mock/personas";
import { type MockRoute, fail, ok, route, validationFailed } from "@/lib/api/mock/router";
import { AUTH_ENDPOINTS } from "@/lib/auth/endpoints";

type SignInBody = { email?: unknown; password?: unknown };

export const authRoutes: MockRoute[] = [
  route("GET", AUTH_ENDPOINTS.me, ({ account }) => ok(account), "signed-in"),

  route(
    "POST",
    AUTH_ENDPOINTS.signIn,
    ({ body }) => {
      const { email, password } = (body ?? {}) as SignInBody;
      const errors: Record<string, string> = {};
      if (typeof email !== "string" || !email.trim()) errors.email = "Enter your email.";
      if (typeof password !== "string" || !password) errors.password = "Enter your password.";
      if (Object.keys(errors).length) return validationFailed(errors);

      const persona = findMockPersonaByEmail(email as string);
      // One generic message whether the email exists or not (SEC-AUTH-05, AU-03).
      if (!persona || password !== MOCK_PASSWORD) {
        return validationFailed({ email: "That email and password don't match. Try again." });
      }
      return { ...ok(resolveMockAccount(persona)), persona };
    },
    "public",
  ),

  route("POST", AUTH_ENDPOINTS.signOut, () => ({ status: 204, persona: "signed-out" }), "signed-in"),

  // Lets screens exercise the 5xx path: GET /api/v1/mock/server-error.
  route("GET", "/mock/server-error", () => fail(500, "SQLSTATE[42S02]: stack trace that must never be shown"), "public"),
];
