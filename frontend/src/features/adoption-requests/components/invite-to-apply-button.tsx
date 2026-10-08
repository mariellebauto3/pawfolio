"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/providers/toast-provider";
import { type InvitedPet, InviteToApplyDialog } from "../dialogs/invite-to-apply-dialog";

type Props = {
  pet: InvitedPet;
  /** The human's match with this pet, shown in the dialog. */
  score?: number;
  /** `invited_at` as the API sent it with the resume: the human's own invite is already with the pet. */
  invited: boolean;
};

// Invite to Apply on a pet's resume (DS-05, FR9). It opens the dialog (RQ-01). Once the invite is out, "Invite
// sent" takes the button's place: one live invite per pet and home is the rule, so there is nothing left to press.
export function InviteToApplyButton({ pet, score, invited: initiallyInvited }: Props) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [invited, setInvited] = useState(initiallyInvited);
  const sent = useRef<HTMLParagraphElement>(null);
  const sentHere = useRef(false);

  // The button the dialog would hand focus back to is gone, so focus goes to what replaced it.
  useEffect(() => {
    if (invited && sentHere.current) sent.current?.focus();
  }, [invited]);

  if (invited) {
    return (
      // Drawn like a button that can't be pressed, as the LoFi has it, but it is a status: nothing here acts.
      <p ref={sent} tabIndex={-1} className="inline-flex min-h-11 items-center gap-2 rounded-pill bg-surface-sunken px-5 font-bold text-ink-muted">
        <Icon name="check" className="size-4 shrink-0" />
        Invite sent
      </p>
    );
  }

  return (
    <>
      <Button variant="primary" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        Invite to Apply
      </Button>
      <InviteToApplyDialog
        open={open}
        onClose={() => setOpen(false)}
        pet={pet}
        score={score}
        onSent={(invite) => {
          sentHere.current = true;
          setInvited(true);
          toast.show(invite ? `Invite sent. You’ll be notified if ${pet.name} applies.` : `Your invite is already with ${pet.name}.`, {
            tone: invite ? "success" : "info",
          });
        }}
      />
    </>
  );
}
