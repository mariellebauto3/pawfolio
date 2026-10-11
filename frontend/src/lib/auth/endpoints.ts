// Auth endpoints under /api/v1 (contract: docs/api/auth.md). Implemented by the backend in BE-03 (session and
// password), BE-04 (sign-up) and BE-06 (account status); the mock answers the same way in mock mode.
export const AUTH_ENDPOINTS = {
  /** The signed-in account, or 401 when signed out. Reachable whatever the account status. */
  me: "/auth/me",
  signIn: "/auth/sign-in",
  signOut: "/auth/sign-out",
  forgotPassword: "/auth/forgot-password",
  resetPassword: "/auth/reset-password",
  /** One endpoint per role, so the role never comes from the request body (SEC-INPUT-04). */
  signUpPet: "/auth/sign-up/pet",
  signUpHuman: "/auth/sign-up/human",
  /** Why the account isn't Active (AU-18, AU-20, AU-21). Reachable whatever the account status. */
  accountStatus: "/account-status",
  /** The details a Pending or Denied owner submitted, to read and to send again (AU-19). */
  submission: "/account/submission",
} as const;
