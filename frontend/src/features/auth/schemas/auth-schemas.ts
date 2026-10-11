import type { FieldErrors } from "@/lib/api/errors";
import { firstPasswordProblem } from "@/lib/auth/password-rules";

// Client checks for the sign-in and password screens (AU-02…AU-06), mirroring the backend Form Requests
// (SignInRequest, ForgotPasswordRequest, ResetPasswordRequest) and their messages. They give quick feedback; the API
// decides (frontend-guidelines §8).

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emailProblem(email: string): string | null {
  if (!email.trim()) return "Enter your email.";
  if (!EMAIL_PATTERN.test(email.trim())) return "Enter a valid email address.";
  return null;
}

export function validateSignIn({ email, password }: { email: string; password: string }): FieldErrors {
  const errors: FieldErrors = {};
  const emailError = emailProblem(email);
  if (emailError) errors.email = emailError;
  if (!password) errors.password = "Enter your password.";
  return errors;
}

export function validateNewPassword({ password, confirmation }: { password: string; confirmation: string }): FieldErrors {
  const errors: FieldErrors = {};
  if (!password) errors.password = "Enter a new password.";
  else {
    const problem = firstPasswordProblem(password);
    if (problem) errors.password = problem;
  }
  if (!confirmation) errors.password_confirmation = "Confirm your new password.";
  else if (password && confirmation !== password) errors.password_confirmation = "The passwords don't match.";
  return errors;
}

export type ResetLink = { token: string; email: string };

/**
 * Reads the emailed reset link's token and email from after the "#" (`#token=…&email=…`, docs/api/auth.md), or null
 * when either is missing. They live after the "#" so they never reach a server (SEC-FE-04).
 */
export function parseResetLink(hash: string): ResetLink | null {
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  const token = params.get("token")?.trim();
  const email = params.get("email")?.trim();
  return token && email && !emailProblem(email) ? { token, email } : null;
}
