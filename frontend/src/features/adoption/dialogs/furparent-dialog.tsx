"use client";

import Link from "next/link";
import { Modal } from "@/components/overlays/modal";
import { buttonClasses } from "@/components/ui/button-styles";
import { ROUTES, petPath } from "@/constants/routes";
import { AdoptionLink } from "../components/adoption-link";
import type { AdoptionPair } from "../types/adoptions";

type Props = AdoptionPair & {
  open: boolean;
  onClose: () => void;
};

// AL-02 You're a Furparent: what the human sees the moment the adoption is recorded (FR13, FR14). It only tells and
// points on: the API has already made the pet Hired, linked the two profiles and closed the pet's other requests.
// An adoption story is written on the community feed (FD-04).
export function FurparentDialog({ open, onClose, pet, home }: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="You’re a Furparent!"
      footer={
        <>
          <Link href={petPath(pet.id)} className={buttonClasses()}>
            View {pet.name}’s alumni profile
          </Link>
          <Link href={ROUTES.memberHome} className={buttonClasses({ variant: "primary" })}>
            Share your adoption story
          </Link>
        </>
      }
    >
      <AdoptionLink state="linked" size="xl" animate pet={pet} home={{ ...home, label: "You" }} />
      <p className="mx-auto max-w-[46ch] text-center">
        <strong>{pet.name}</strong> got Hired and is now linked to your profile for good. Your Furparent badge is live, and {pet.name}’s other open
        requests were closed.
      </p>
    </Modal>
  );
}
