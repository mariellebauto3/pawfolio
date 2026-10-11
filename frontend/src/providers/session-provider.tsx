"use client";

import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, onApiError } from "@/lib/api/client";
import { errorRedirect, homePathFor, routeArea, routeRedirect } from "@/lib/auth/redirects";
import { fetchSession } from "@/lib/auth/session";
import { announceSessionChange, onSessionChangeElsewhere, sessionChange } from "@/lib/auth/session-sync";
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
  /** Holds automatic session updates while sign-in replaces the current page. Call the returned function on failure. */
  pauseSessionChecks: () => () => void;
};

type SessionState = { status: SessionStatus; account: Account | null };

type Props = {
  children: ReactNode;
  /** The account already loaded on the server (`fetchSession(await getServerApi())`); null when signed out. Leave it
   *  out to load it in the browser. */
  initialAccount?: Account | null;
};

const SessionContext = createContext<Session | null>(null);

/** A tab that is looked at again asks who is signed in, but not more often than this. */
const RECHECK_INTERVAL_MS = 3000;

// Mounted once in the root layout. The account lives in React state only — never in localStorage, sessionStorage or
// the URL (SEC-AUTH-01, SEC-FE-04). What it says about role and status is for showing the right UI; the API checks
// every request itself (SEC-FE-05).
export function SessionProvider({ children, initialAccount }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<SessionState>(() => initialState(initialAccount));
  const sessionChecksPaused = useRef(false);
  const pauseSessionChecks = useCallback(() => {
    sessionChecksPaused.current = true;
    return () => { sessionChecksPaused.current = false; };
  }, []);

  // Whose pages this tab shows, for the checks below. Null while nobody is signed in or it isn't known yet.
  const shownId = useRef<number | null>(initialAccount?.id ?? null);
  useEffect(() => {
    shownId.current = state.account?.id ?? null;
  }, [state.account]);

  const refresh = useCallback(async () => {
    const loaded = await loadAccount();
    // Signed in or out from this tab: the browser's other tabs are told to look at their own session.
    if (loaded.ok && sessionChange(shownId.current, loaded.account?.id ?? null) !== "none") announceSessionChange();
    setState((previous) => nextState(previous, loaded));
    return loaded.ok ? loaded.account : null;
  }, []);

  useEffect(() => {
    if (initialAccount !== undefined) return;
    let unmounted = false;
    void loadAccount().then((loaded) => {
      if (!unmounted && !sessionChecksPaused.current) setState((previous) => nextState(previous, loaded));
    });
    return () => {
      unmounted = true;
    };
  }, [initialAccount]);

  // One account per browser. The session cookie is shared by every tab, so another tab can end this session or
  // start another account's. When this tab is looked at again, or another tab says the session changed, it asks
  // the API who is signed in and never keeps showing one account's pages on another account's session:
  //   signed out elsewhere      → the page is loaded again, and the sign-in page takes over where one is needed
  //   another account signed in → a full load of that account's own home, so nothing of the first one stays
  //   signed in elsewhere       → the page is rendered again (a sign-in page left open sends the visitor on)
  // If the API can't say, nothing happens: "we couldn't check" is never treated as signed out.
  useEffect(() => {
    let lastCheck = 0;
    let stopped = false;

    async function check(force: boolean) {
      if (sessionChecksPaused.current) return;
      if (!force && (document.visibilityState !== "visible" || Date.now() - lastCheck < RECHECK_INTERVAL_MS)) return;
      lastCheck = Date.now();
      const loaded = await loadAccount();
      if (stopped || sessionChecksPaused.current || !loaded.ok) return;

      const change = sessionChange(shownId.current, loaded.account?.id ?? null);
      if (change === "switched" && loaded.account) return window.location.assign(homePathFor(loaded.account));
      if (change === "signed-out") return window.location.reload();
      setState((previous) => nextState(previous, loaded));
      if (change === "signed-in") router.refresh();
    }

    const onLookedAt = () => void check(false);
    window.addEventListener("focus", onLookedAt);
    document.addEventListener("visibilitychange", onLookedAt);
    const stopListening = onSessionChangeElsewhere(() => void check(true));
    return () => {
      stopped = true;
      window.removeEventListener("focus", onLookedAt);
      document.removeEventListener("visibilitychange", onLookedAt);
      stopListening();
    };
  }, [router]);

  // 401 → sign-in; account no longer Active (e.g. suspended mid-session) → account-status screen.
  useEffect(
    () =>
      onApiError((error) => {
        if (error.kind === "unauthenticated") setState({ status: "signed-out", account: null });
        if (error.kind === "account_not_active") void refresh();
        if (error.kind === "forbidden" && error.code === "role_not_allowed") {
          setState({ status: "loading", account: null });
          void refresh().then((account) => {
            if (account) router.replace(homePathFor(account));
          });
          return;
        }
        const currentPath = `${window.location.pathname}${window.location.search}`;
        const target = errorRedirect(error, currentPath);
        if (target && target !== currentPath) router.replace(target);
      }),
    [router, refresh],
  );

  // Cached client navigation and a session changed in another tab must never paint a disallowed page.
  const protectedPage = routeArea(pathname) !== "public" || pathname === "/admins-only";
  const away = state.status === "signed-in" || state.status === "signed-out"
    ? routeRedirect(pathname, state.account)
    : null;
  useEffect(() => {
    if (away) router.replace(away);
  }, [away, router]);
  const hidePage = Boolean(away) || (protectedPage && (state.status === "loading" || state.status === "error"));

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
      pauseSessionChecks,
    };
  }, [state, refresh, pauseSessionChecks]);

  return <SessionContext.Provider value={session}>{hidePage ? null : children}</SessionContext.Provider>;
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
