// Auth endpoints under /api/v1 (contract: docs/api/auth.md). Implemented by the backend in BE-03; the two sign-up
// endpoints are BE-04 and answered by the mock until then.
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
} as const;
