"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { buttonClasses } from "@/components/ui/button-styles";
import { ROUTES } from "@/constants/routes";
import { homePathFor } from "@/lib/auth/redirects";
import { cn } from "@/lib/utils/cn";
import { useSession } from "@/providers/session-provider";
import type { Account } from "@/types/account";
import { SignOutButton } from "./sign-out-button";

type Props = {
  /** `bar`: side by side in the top bar. `drawer`: stacked, full width, in the phone menu. */
  layout: "bar" | "drawer";
  /** Closes the drawer when a link is chosen. */
  onNavigate?: () => void;
};

/** Where "back into Pawfolio" leads for this account, in the words of that place. */
function homeLabel(account: Account): string {
  if (account.status !== "active") return "My account status";
  return account.role === "admin" ? "Admin dashboard" : "Go to my feed";
}

// Public pages such as password reset can be opened while signed in. Show the current account and its home
// instead of offering another sign-in. Laravel independently enforces the session on every API (SEC-FE-05).
export function GuestActions({ layout, onNavigate }: Props) {
  const { account, status } = useSession();
  const drawer = layout === "drawer";

  if (!account && status !== "signed-out") {
    return (
      <span role="status" className="text-sm text-ink-muted">
        {status === "error" ? "Session unavailable" : "Checking session…"}
      </span>
    );
  }

  if (!account) {
    return (
      <>
        <Link href={ROUTES.signUp} onClick={onNavigate} className={buttonClasses(drawer ? { variant: "primary", block: true } : { variant: "tertiary", size: "sm" })}>
          Join now
        </Link>
        <Link href={ROUTES.signIn} onClick={onNavigate} className={buttonClasses(drawer ? { variant: "secondary", block: true } : { variant: "secondary", size: "sm" })}>
          Sign in
        </Link>
      </>
    );
  }

  return (
    <>
      <span className={cn("flex min-w-0 items-center gap-2", drawer && "px-1 pb-1")}>
        <Avatar name={account.display_name} src={account.avatar_url ?? undefined} alt="" size="sm" />
        {/* The bar has no room for a name beside its links until it is wide. */}
        <span className={cn("min-w-0 truncate text-sm", !drawer && "hidden max-w-40 lg:inline")}>
          <span className="text-ink-muted">Signed in as </span>
          <span className="font-bold">{account.display_name}</span>
        </span>
        {!drawer && <span className="sr-only lg:hidden">Signed in as {account.display_name}</span>}
      </span>
      <Link href={homePathFor(account)} onClick={onNavigate} className={buttonClasses(drawer ? { variant: "primary", block: true } : { variant: "primary", size: "sm" })}>
        {homeLabel(account)}
      </Link>
      <SignOutButton variant={drawer ? "secondary" : "tertiary"} className={drawer ? "w-full" : undefined} />
    </>
  );
}
