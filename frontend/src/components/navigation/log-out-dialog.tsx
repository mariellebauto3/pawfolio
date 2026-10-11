"use client";

import { ConfirmDialog } from "@/components/overlays/confirm-dialog";
import { useSignOut } from "@/hooks/use-sign-out";

type Props = {
  open: boolean;
  onClose: () => void;
};

// Every "Log out" asks first, whatever the role or shell (ui-guidelines §5): a slip on the menu shouldn't end the
// session. Not marked destructive: nothing is lost, the account signs in again.
export function LogOutDialog({ open, onClose }: Props) {
  const signOut = useSignOut();
  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      title="Log out of Pawfolio?"
      confirmLabel="Log out"
      cancelLabel="Stay signed in"
      onConfirm={signOut}
    >
      <p>You&apos;ll need to sign in again to come back.</p>
    </ConfirmDialog>
  );
}
