"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LogOutDialog } from "./log-out-dialog";

type Props = {
  variant?: "secondary" | "tertiary";
  className?: string;
};

// "Log out" as a button, for bars without a Me menu: the account-status bar and the admin sidebar. It opens the
// confirmation; the dialog does the logging out.
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
