"use client";

import type { ReactNode } from "react";
import { shellAreaFor } from "@/lib/auth/shell-area";
import { useSession } from "@/providers/session-provider";
import { AccountStatusShell } from "./account-status-shell";
import { AdminShell } from "./admin-shell";
import { GuestShell } from "./guest-shell";
import { MemberShell } from "./member-shell";

// The shell for the signed-in account, for pages that no route group wraps: the app-wide not-found page (GN-02)
// shown for any unknown URL.
export function SessionShell({ children }: { children: ReactNode }) {
  const { account } = useSession();
  switch (shellAreaFor(account)) {
    case "admin":
      return <AdminShell>{children}</AdminShell>;
    case "member":
      return <MemberShell>{children}</MemberShell>;
    case "account-status":
      return <AccountStatusShell>{children}</AccountStatusShell>;
    default:
      return <GuestShell>{children}</GuestShell>;
  }
}
