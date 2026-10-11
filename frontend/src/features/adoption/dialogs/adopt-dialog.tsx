"use client";

import { type FormEvent, useState } from "react";
import { Alert } from "@/components/feedback/alert";
import { Checkbox } from "@/components/forms/checkbox";
import { Modal } from "@/components/overlays/modal";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { adoptPet } from "../api/adoptions";
import { AdoptionLink } from "../components/adoption-link";
import type { AdoptionPair } from "../types/adoptions";

type Props = AdoptionPair & {
  open: boolean;
  onClose: () => void;
  requestId: number;
  /** The pet is adopted. The dialog has closed; the caller celebrates and shows where the request stands. */
  onAdopted: () => void;
  /**
   * The API says it can't be adopted any more (decided in another tab, or the pet withdrew): nothing changed, and
   * the page behind is out of date. The caller reads it again and says why, since this dialog goes with the old panel.
   */
  onStale: (message: string) => void;
};

const UNKNOWN_PROBLEM = "We couldn't record the adoption. Check your connection and try again.";

// AL-01 Adopt confirmation: the final, permanent decision (FR12). It says what will happen and waits for the human
// to tick that they met the pet, so a slip can't adopt one. Nobody sets "Adopted" by hand: the API does all of it on
// this one action (FR27), and decides whether the decision is still open, whatever is on the screen (SEC-FE-05).
export function AdoptDialog(props: Props) {
  // Mounted only while open, so every visit starts with the box unticked.
  return props.open ? <AdoptDialogContent {...props} /> : null;
}

function AdoptDialogContent({ onClose, requestId, pet, home, onAdopted, onStale }: Props) {
  const [ready, setReady] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || busy) return;
    setProblem(null);
    setBusy(true);
    try {
      await adoptPet(api, requestId);
      onClose();
      onAdopted();
    } catch (failure) {
      setBusy(false);
      if (!isApiError(failure)) return setProblem(UNKNOWN_PROBLEM);
      // Decided already, withdrawn, or adopted elsewhere: the page should show that.
      if (failure.kind === "conflict") onStale(failure.message);
      setProblem(failure.kind === "not_found" ? "This request isn’t available any more." : failure.message);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      role="alertdialog"
      title={`Adopt ${pet.name}?`}
      subtitle="This is permanent."
      dismissible={!busy}
      closeOnBackdrop={false}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Not yet
          </Button>
          <Button type="submit" variant="primary" disabled={!ready} loading={busy} loadingLabel={`Adopting ${pet.name}`}>
            Yes, adopt {pet.name}
          </Button>
        </>
      }
    >
      <AdoptionLink state="pending" pet={pet} home={{ ...home, label: "You" }} />

      <div className="flex flex-col gap-2">
        <p className="text-sm font-bold">What happens</p>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm marker:text-ink-subtle">
          <li>{pet.name} becomes Adopted — Hired, with an alumni profile linked to you for good.</li>
          <li>You get the Furparent label on your Home Profile.</li>
          <li>{pet.name}’s other open requests close automatically.</li>
          <li>Open to Adopt turns off. Turn it back on whenever you’re ready for another pet.</li>
        </ul>
      </div>

      <Checkbox
        label={`I met ${pet.name} and I’m ready to take them home.`}
        checked={ready}
        onChange={(event) => setReady(event.target.checked)}
        disabled={busy}
      />

      {problem && (
        <Alert tone="error" announce>
          {problem}
        </Alert>
      )}
    </Modal>
  );
}
