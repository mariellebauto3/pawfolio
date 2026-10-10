"use client";

import { useCallback } from "react";
import { api } from "@/lib/api/client";
import { afterSignInPath } from "@/lib/auth/redirects";
import { announceSessionChange } from "@/lib/auth/session-sync";
import { useSession } from "@/providers/session-provider";
import { signIn, type SignInInput } from "../api/auth";

/** Keep the guest page pending until the dashboard loads with its server-seeded session. */
export function useSignIn(next: string | null): (input: SignInInput) => Promise<never> {
  const { pauseSessionChecks } = useSession();
  return useCallback(async (input: SignInInput) => {
    const resumeSessionChecks = pauseSessionChecks();
    try {
      // Laravel initializes the session before returning this validated account. No second /auth/me is needed here.
      const account = await signIn(api, input);
      announceSessionChange();
      window.location.replace(afterSignInPath(account, next));
    } catch (error) {
      resumeSessionChecks();
      throw error;
    }
    // As with sign-out, a fresh document replaces the provider and router cache. Leave the old UI pending.
    return await new Promise<never>(() => {});
  }, [next, pauseSessionChecks]);
}
