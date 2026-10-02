"use client";

import { useCallback, useState } from "react";
import { api } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { AUTH_ENDPOINTS } from "@/lib/auth/endpoints";
import { ROUTES } from "@/constants/routes";
import { useToast } from "@/providers/toast-provider";

/**
 * Log out → landing page (GN-01, AU-18). The API ends the session (SEC-AUTH-07); then a full page load replaces the
 * app, so no signed-in data stays in React state or the router cache.
 */
export function useSignOut(): { signOut: () => Promise<void>; pending: boolean } {
  const toast = useToast();
  const [pending, setPending] = useState(false);

  const signOut = useCallback(async () => {
    setPending(true);
    try {
      await api.post(AUTH_ENDPOINTS.signOut, undefined, { skipAuthRedirect: true });
    } catch (error) {
      // Already signed out (session expired) is the result we wanted.
      if (!(isApiError(error) && error.kind === "unauthenticated")) {
        setPending(false);
        toast.show("We couldn't log you out. Check your connection and try again.", { tone: "error" });
        return;
      }
    }
    window.location.assign(ROUTES.landing);
  }, [toast]);

  return { signOut, pending };
}
