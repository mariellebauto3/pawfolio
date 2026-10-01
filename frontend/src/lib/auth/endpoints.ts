// Auth endpoints under /api/v1 (contract: docs/api/README.md). Implemented by the backend in BE-03.
export const AUTH_ENDPOINTS = {
  /** The signed-in account, or 401 when signed out. Reachable whatever the account status. */
  me: "/auth/me",
  signIn: "/auth/sign-in",
  signOut: "/auth/sign-out",
} as const;
