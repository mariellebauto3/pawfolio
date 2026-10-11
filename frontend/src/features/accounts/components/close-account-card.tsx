"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DeactivateAccountDialog } from "../dialogs/deactivate-account-dialog";

type Props = {
  role: "pet" | "human";
  /** The pet's or the human's name, for the button's full name to screen readers. */
  name: string;
};

// "Close account", the last card of Settings (AC-01, AC-02 → AC-05). The button is the quiet outlined one: a
// destructive action is never the page's primary, and the dialog confirms it with the password.
export function CloseAccountCard({ role, name }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Card title="Close account">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <p className="max-w-[48ch] text-sm text-ink-muted">Your profile is hidden and you are signed out for good. Adoption history and logs are kept.</p>
          <Button size="sm" onClick={() => setOpen(true)}>
            Deactivate account
            <span className="sr-only">: {name}</span>
          </Button>
        </div>
      </Card>
      <DeactivateAccountDialog open={open} onClose={() => setOpen(false)} role={role} />
    </>
  );
}
