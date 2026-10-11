"use client";

import Link from "next/link";
import { Modal } from "@/components/overlays/modal";
import { buttonClasses } from "@/components/ui/button-styles";
import { ROUTES } from "@/constants/routes";
import { AdoptionLink } from "../components/adoption-link";
import type { AdoptionPair } from "../types/adoptions";

type Props = AdoptionPair & {
  open: boolean;
  onClose: () => void;
};

// AL-03 You got Hired: what changed for the pet once its human chose Adopt (FR28, FR29). Its profile is an alumni
// profile now, with the Hired badge, linked to its Furparent; its own page shows it, and it can still post updates
// on the community feed (FD-03).
export function HiredDialog({ open, onClose, pet, home }: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="You got Hired!"
      footer={
        <>
          <Link href={ROUTES.me} className={buttonClasses()}>
            View my alumni profile
          </Link>
          <Link href={ROUTES.memberHome} className={buttonClasses({ variant: "primary" })}>
            Post an update
          </Link>
        </>
      }
    >
      <AdoptionLink state="linked" size="xl" animate pet={{ ...pet, label: "You" }} home={{ ...home, caption: "Your Furparent" }} />
      <p className="mx-auto max-w-[46ch] text-center">
        <strong>{home.name}</strong> chose to adopt you! Your profile is now an alumni profile with the Hired badge, linked to your Furparent. Your other
        open requests were closed.
      </p>
    </Modal>
  );
}
