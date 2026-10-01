"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, onApiError } from "@/lib/api/client";
import { errorRedirect } from "@/lib/auth/redirects";
import { fetchSession } from "@/lib/auth/session";
import type { Account } from "@/types/account";
import type { AccountStatus, Role } from "@/types/statuses";

/** `error`: the session couldn't be checked (API down, offline) — not the same as signed out. */
export type SessionStatus = "loading" | "signed-in" | "signed-out" | "error";

export type Session = {
  status: SessionStatus;
  account: Account | null;
  role: Role | null;
  accountStatus: AccountStatus | null;
  isActive: boolean;
  isAdmin: boolean;
  /** Reloads the account from the API, e.g. right after signing in or out. */
  refresh: () => Promise<Account | null>;
};

type SessionState = { status: SessionStatus; account: Account | null };

type Props = {
  children: ReactNode;
  /** The account already loaded on the server (`fetchSession(await getServerApi())`); null when signed out. Leave it
   *  out to load it in the browser. */
  initialAccount?: Account | null;
};

const SessionContext = createContext<Session | null>(null);

// Mounted once in the root layout. The account lives in React state only — never in localStorage, sessionStorage or
// the URL (SEC-AUTH-01, SEC-FE-04). What it says about role and status is for showing the right UI; the API checks
// every request itself (SEC-FE-05).
export function SessionProvider({ children, initialAccount }: Props) {
  const router = useRouter();
  const [state, setState] = useState<SessionState>(() => initialState(initialAccount));

  const refresh = useCallback(async () => {
    const loaded = await loadAccount();
    setState((previous) => nextState(previous, loaded));
    return loaded.ok ? loaded.account : null;
  }, []);

  useEffect(() => {
    if (initialAccount !== undefined) return;
    let unmounted = false;
    void loadAccount().then((loaded) => {
      if (!unmounted) setState((previous) => nextState(previous, loaded));
    });
    return () => {
      unmounted = true;
    };
  }, [initialAccount]);

  // 401 → sign-in; account no longer Active (e.g. suspended mid-session) → account-status screen.
  useEffect(
    () =>
      onApiError((error) => {
        if (error.kind === "unauthenticated") setState({ status: "signed-out", account: null });
        if (error.kind === "account_not_active") void refresh();
        const currentPath = `${window.location.pathname}${window.location.search}`;
        const target = errorRedirect(error, currentPath);
        if (target && target !== currentPath) router.replace(target);
      }),
    [router, refresh],
  );

  const session = useMemo<Session>(() => {
    const { account } = state;
    const isActive = account?.status === "active";
    return {
      ...state,
      role: account?.role ?? null,
      accountStatus: account?.status ?? null,
      isActive,
      isAdmin: isActive && account?.role === "admin",
      refresh,
    };
  }, [state, refresh]);

  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession() needs a <SessionProvider> above it (see src/app/layout.tsx).");
  return session;
}

type Loaded = { ok: true; account: Account | null } | { ok: false };

async function loadAccount(): Promise<Loaded> {
  try {
    return { ok: true, account: await fetchSession(api) };
  } catch {
    return { ok: false };
  }
}

function nextState(previous: SessionState, loaded: Loaded): SessionState {
  if (!loaded.ok) return { status: "error", account: previous.account };
  return loaded.account ? { status: "signed-in", account: loaded.account } : { status: "signed-out", account: null };
}

function initialState(initialAccount: Account | null | undefined): SessionState {
  if (initialAccount === undefined) return { status: "loading", account: null };
  return initialAccount ? { status: "signed-in", account: initialAccount } : { status: "signed-out", account: null };
}
