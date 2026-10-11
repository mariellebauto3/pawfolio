"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LogOutDialog } from "./log-out-dialog";

type Props = {
  variant?: "secondary" | "tertiary";
  className?: string;
};

// "Log out" for the account-status bar and public pages opened while signed in. The dialog confirms and performs
// the sign-out. The admin sidebar uses its own row.
export function SignOutButton({ variant = "secondary", className }: Props) {
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <Button variant={variant} size="sm" aria-haspopup="dialog" onClick={() => setConfirming(true)} className={className}>
        Log out
      </Button>
      <LogOutDialog open={confirming} onClose={() => setConfirming(false)} />
    </>
  );
}
