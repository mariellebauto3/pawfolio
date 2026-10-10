"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/providers/toast-provider";
import { ChangePasswordDialog } from "../dialogs/change-password-dialog";

// "Change password" on the Sign-in & security card (AC-01, AC-02 → AC-04).
export function PasswordCardActions() {
  const toast = useToast();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Change password
      </Button>
      <ChangePasswordDialog open={open} onClose={() => setOpen(false)} onChanged={() => toast.show("Password changed. Other devices were signed out.")} />
    </>
  );
}
