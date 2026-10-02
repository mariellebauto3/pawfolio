"use client";

import { Button } from "@/components/ui/button";
import { useSignOut } from "@/hooks/use-sign-out";

type Props = {
  variant?: "secondary" | "tertiary";
  className?: string;
};

// "Log out" as a button, for bars without a Me menu: the account-status bar and the admin sidebar.
export function SignOutButton({ variant = "secondary", className }: Props) {
  const { signOut, pending } = useSignOut();
  return (
    <Button variant={variant} size="sm" loading={pending} loadingLabel="Logging out" onClick={() => void signOut()} className={className}>
      Log out
    </Button>
  );
}
