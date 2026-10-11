// New-password rules (SEC-AUTH-03, AU-06), mirroring the backend's ResetPasswordRequest and its messages, so the
// form can show them as you type. The API is the authority: it also refuses known-breached passwords, which only
// the server can check.

export type PasswordRule = { id: "length" | "letter" | "number"; label: string; message: string; test: (password: string) => boolean };

export const MIN_PASSWORD_LENGTH = 8;

export const PASSWORD_RULES: readonly PasswordRule[] = [
  {
    id: "length",
    label: `At least ${MIN_PASSWORD_LENGTH} characters`,
    message: `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
    test: (password) => password.length >= MIN_PASSWORD_LENGTH,
  },
  {
    id: "letter",
    label: "A letter",
    message: "Include at least one letter.",
    test: (password) => /\p{L}/u.test(password),
  },
  {
    id: "number",
    label: "A number",
    message: "Include at least one number.",
    test: (password) => /\p{N}/u.test(password),
  },
];

/** The first rule the password breaks, as the API words it, or null when it meets them all. */
export function firstPasswordProblem(password: string): string | null {
  return PASSWORD_RULES.find((rule) => !rule.test(password))?.message ?? null;
}

export type PasswordStrength = { score: 0 | 1 | 2 | 3 | 4; label: "Too short" | "Weak" | "Fair" | "Good" | "Strong" };

/**
 * A rough strength for the meter under the new-password field (AU-06): length and variety only. It guides; the
 * rules above decide what the API accepts.
 */
export function passwordStrength(password: string): PasswordStrength {
  if (password.length < MIN_PASSWORD_LENGTH) return { score: 0, label: "Too short" };
  const kinds = [/\p{Ll}/u, /\p{Lu}/u, /\p{N}/u, /[^\p{L}\p{N}]/u].filter((kind) => kind.test(password)).length;
  const points = kinds + (password.length >= 12 ? 1 : 0) + (password.length >= 16 ? 1 : 0);
  if (points <= 2) return { score: 1, label: "Weak" };
  if (points === 3) return { score: 2, label: "Fair" };
  if (points === 4) return { score: 3, label: "Good" };
  return { score: 4, label: "Strong" };
}
