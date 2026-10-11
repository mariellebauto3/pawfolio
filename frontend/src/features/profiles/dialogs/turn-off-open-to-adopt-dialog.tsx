"use client";

import { ConfirmDialog } from "@/components/overlays/confirm-dialog";
import { api } from "@/lib/api/client";
import { setOpenToAdopt } from "../api/home-profile";
import type { OwnHomeProfile } from "../types/own-home-profile";

type Props = {
  open: boolean;
  onClose: () => void;
  /** The Home Profile as the API answered once Open to Adopt was off. */
  onTurnedOff: (home: OwnHomeProfile) => void;
};

// PR-13 Turn off Open to Adopt: says what stops and what carries on before the switch goes off (FR4, proposal
// §5.5). It can be turned back on at any time, so it isn't a destructive action.
export function TurnOffOpenToAdoptDialog({ open, onClose, onTurnedOff }: Props) {
  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      title="Turn off Open to Adopt?"
      subtitle="You can turn it back on at any time."
      confirmLabel="Turn off"
      cancelLabel="Keep it on"
      consequences={[
        "Pets can’t send you new adoption requests.",
        "You won’t appear in pets’ Homes for You.",
        "Requests already in progress continue.",
      ]}
      onConfirm={async () => onTurnedOff(await setOpenToAdopt(api, false))}
    />
  );
}
