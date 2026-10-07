"use client";

import { useState } from "react";
import { Toggle } from "@/components/forms/toggle";
import { api } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { useToast } from "@/providers/toast-provider";
import { setOpenToAdopt } from "../api/home-profile";
import { TurnOffOpenToAdoptDialog } from "../dialogs/turn-off-open-to-adopt-dialog";
import type { OwnHomeProfile } from "../types/own-home-profile";

type Props = {
  home: OwnHomeProfile;
  /** The Home Profile as the API answered after the switch moved. */
  onChange: (home: OwnHomeProfile) => void;
  /** Under the label while the switch can be used, e.g. "Let pets send me adoption requests." */
  description?: string;
  className?: string;
};

const UNKNOWN_PROBLEM = "We couldn't change Open to Adopt. Check your connection and try again.";

// The Open to Adopt switch (FR4), on My Home Profile (PR-11) and on "Home Profile saved" (PR-20). Turning it on
// applies right away; turning it off asks first (PR-13). The switch shows what the API last answered, never a guess:
// the API refuses to turn it on before the quiz is finished, so until then it is shown locked.
export function OpenToAdoptToggle({ home, onChange, description, className }: Props) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const locked = !home.has_completed_quiz && !home.is_open_to_adopt;

  async function turnOn() {
    setBusy(true);
    try {
      onChange(await setOpenToAdopt(api, true));
      toast.show("Open to Adopt is on. Pets can send you adoption requests.");
    } catch (failure) {
      toast.show(isApiError(failure) ? failure.message : UNKNOWN_PROBLEM, { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Toggle
        label="Open to Adopt"
        description={locked ? "Finish your Home Profile & quiz to turn this on." : description}
        checked={home.is_open_to_adopt}
        disabled={busy || locked}
        onChange={(event) => (event.target.checked ? void turnOn() : setConfirming(true))}
        className={className}
      />
      <TurnOffOpenToAdoptDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onTurnedOff={(next) => {
          onChange(next);
          toast.show("Open to Adopt is off. Requests already in progress continue.");
        }}
      />
    </>
  );
}
