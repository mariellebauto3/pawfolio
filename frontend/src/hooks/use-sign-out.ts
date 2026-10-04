"use client";

import { useCallback } from "react";
import { api } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { AUTH_ENDPOINTS } from "@/lib/auth/endpoints";
import { ROUTES } from "@/constants/routes";

/**
 * Log out → landing page (GN-01, AU-18). The API ends the session (SEC-AUTH-07); then a full page load replaces the
 * app, so no signed-in data stays in React state or the router cache. Rejects when the session couldn't be ended, so
 * the dialog that asked (`LogOutDialog`) stays open and offers another try.
 */
export function useSignOut(): () => Promise<void> {
  return useCallback(async () => {
    try {
      await api.post(AUTH_ENDPOINTS.signOut, undefined, { skipAuthRedirect: true });
    } catch (error) {
      // Already signed out (session expired) is the result we wanted.
      if (!(isApiError(error) && error.kind === "unauthenticated")) throw error;
    }
    window.location.assign(ROUTES.landing);
    // The page is being replaced. Staying pending until it is keeps the dialog busy instead of closing onto a
    // signed-in page for a moment.
    await new Promise<never>(() => {});
  }, []);
}
