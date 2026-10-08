"use client";

import Link from "next/link";
import { Modal } from "@/components/overlays/modal";
import { Button } from "@/components/ui/button";
import { buttonClasses } from "@/components/ui/button-styles";
import { ApplyBlockedDetails, applyBlockedHeading, applyBlockedWayOut } from "../components/apply-blocked-details";
import type { ApplyBlocker } from "../schemas/apply-state";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Which rule is in the way (`applyStateFor`). */
  blocker: ApplyBlocker;
  /** The home the pet wanted to apply to. */
  homeName: string;
};

// RQ-05 Request limit reached and RQ-06 Cooldown after a decline, and the same dialog for a pet that is already in
// process with another home. It opens from Apply on a Home Profile, and from the Send request form when the API
// answers 409: the rule is the API's, and this only explains it (SEC-FE-05).
export function ApplyBlockedDialog({ open, onClose, blocker, homeName }: Props) {
  const { title, subtitle } = applyBlockedHeading(blocker, homeName);
  const wayOut = applyBlockedWayOut(blocker);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      footer={
        <>
          <Button onClick={onClose}>Not now</Button>
          <Link href={wayOut.href} className={buttonClasses({ variant: "primary" })}>
            {wayOut.label}
          </Link>
        </>
      }
    >
      <ApplyBlockedDetails blocker={blocker} homeName={homeName} />
    </Modal>
  );
}
