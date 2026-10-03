import { beforeEach, describe, expect, it } from "vitest";
import { requestPasswordReset, resetPassword, signIn } from "@/features/auth/api/auth";
import { createApiClient } from "@/lib/api/core";
import { MOCK_RESET_TOKEN, resetMockSignInAttempts } from "@/lib/api/mock/handlers/auth";
import { MOCK_PERSONA_COOKIE, createMockTransport } from "@/lib/api/mock/transport";

const MISMATCH = "That email and password don't match. Try again.";

function client() {
  let persona: string | null = "signed-out";
  return createApiClient(
    createMockTransport({
      readCookie: (name) => (name === MOCK_PERSONA_COOKIE ? persona : null),
      writePersona: (next) => {
        persona = next;
      },
      latencyMs: 0,
    }),
  );
}

describe("mock auth handlers follow docs/api/auth.md", () => {
  beforeEach(() => resetMockSignInAttempts());

  it("signs in and returns the account, with remember accepted", async () => {
    const account = await signIn(client(), { email: " Ana.Santos@example.com ", password: "password", remember: true });
    expect(account).toMatchObject({ role: "human", status: "active" });
  });

  it("answers one generic message, and 'closed' only after the right password", async () => {
    const attempt = (email: string, password: string) => signIn(client(), { email, password, remember: false });
    await expect(attempt("nobody@example.com", "x")).rejects.toMatchObject({ kind: "validation", fieldErrors: { email: MISMATCH } });
    await expect(attempt("jun.reyes@example.com", "wrong")).rejects.toMatchObject({ fieldErrors: { email: MISMATCH } });
    await expect(attempt("jun.reyes@example.com", "password")).rejects.toMatchObject({
      fieldErrors: { email: "This account was closed." },
    });
  });

  it("locks an email after 5 failures with Retry-After, even for the right password", async () => {
    const api = client();
    for (let i = 0; i < 5; i++) {
      await expect(signIn(api, { email: "mochi@example.com", password: "wrong", remember: false })).rejects.toMatchObject({
        kind: "validation",
      });
    }
    const error = await signIn(api, { email: "mochi@example.com", password: "password", remember: false }).catch(
      (failure: unknown) => failure,
    );
    expect(error).toMatchObject({ kind: "rate_limited", status: 429 });
    expect((error as { retryAfterSeconds: number }).retryAfterSeconds).toBeGreaterThan(890);
    // Another account is unaffected.
    await expect(signIn(api, { email: "ana.santos@example.com", password: "password", remember: false })).resolves.toBeTruthy();
  });

  it("answers forgot-password the same for any valid email", async () => {
    await expect(requestPasswordReset(client(), "mochi@example.com")).resolves.toBeUndefined();
    await expect(requestPasswordReset(client(), "nobody@example.com")).resolves.toBeUndefined();
    await expect(requestPasswordReset(client(), "nope")).rejects.toMatchObject({
      fieldErrors: { email: "Enter a valid email address." },
    });
  });

  it("resets with the mock token and refuses a bad link or a weak password", async () => {
    const good = {
      token: MOCK_RESET_TOKEN,
      email: "mochi@example.com",
      password: "newpass123",
      password_confirmation: "newpass123",
    };
    await expect(resetPassword(client(), good)).resolves.toBeUndefined();
    await expect(resetPassword(client(), { ...good, token: "old" })).rejects.toMatchObject({
      fieldErrors: { token: "This reset link is invalid or has expired. Ask for a new one." },
    });
    await expect(resetPassword(client(), { ...good, password: "letters", password_confirmation: "letters" })).rejects.toMatchObject({
      fieldErrors: { password: "Use at least 8 characters." },
    });
  });
});
