import { describe, expect, it } from "vitest";
import { emailProblem, parseResetLink, validateNewPassword, validateSignIn } from "@/features/auth/schemas/auth-schemas";

describe("sign-in and password schemas (mirror the backend Form Requests)", () => {
  it("checks the email like SignInRequest", () => {
    expect(emailProblem("")).toBe("Enter your email.");
    expect(emailProblem("ana.santos")).toBe("Enter a valid email address.");
    expect(emailProblem(" ana@example.com ")).toBeNull();
  });

  it("needs an email and a password to sign in", () => {
    expect(validateSignIn({ email: "", password: "" })).toEqual({
      email: "Enter your email.",
      password: "Enter your password.",
    });
    expect(validateSignIn({ email: "ana@example.com", password: "x" })).toEqual({});
  });

  it("gives the first broken password rule, then the confirmation", () => {
    expect(validateNewPassword({ password: "", confirmation: "" })).toEqual({
      password: "Enter a new password.",
      password_confirmation: "Confirm your new password.",
    });
    expect(validateNewPassword({ password: "short1", confirmation: "short1" }).password).toBe("Use at least 8 characters.");
    expect(validateNewPassword({ password: "onlyletters", confirmation: "onlyletters" }).password).toBe(
      "Include at least one number.",
    );
    expect(validateNewPassword({ password: "12345678", confirmation: "12345678" }).password).toBe(
      "Include at least one letter.",
    );
    expect(validateNewPassword({ password: "newpass123", confirmation: "newpass124" })).toEqual({
      password_confirmation: "The passwords don't match.",
    });
    expect(validateNewPassword({ password: "newpass123", confirmation: "newpass123" })).toEqual({});
  });

  it("reads the reset link from after the # and refuses incomplete links", () => {
    expect(parseResetLink("#token=abc123&email=mochi%40example.com")).toEqual({
      token: "abc123",
      email: "mochi@example.com",
    });
    expect(parseResetLink("token=abc123&email=mochi%40example.com")).toEqual({
      token: "abc123",
      email: "mochi@example.com",
    });
    expect(parseResetLink("#token=abc123")).toBeNull();
    expect(parseResetLink("#email=mochi%40example.com")).toBeNull();
    expect(parseResetLink("#token=abc&email=not-an-email")).toBeNull();
    expect(parseResetLink("")).toBeNull();
  });
});
