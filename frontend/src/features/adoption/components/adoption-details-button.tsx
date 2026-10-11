"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { ButtonSize, ButtonVariant } from "@/components/ui/button-styles";
import { AdoptionDetailsDialog } from "../dialogs/adoption-details-dialog";

type Props = {
  adoptionId: number;
  petName: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** A list of adopted pets has one of these per pet: each then says whose details it opens. */
  named?: boolean;
  /** On the Adopted request itself (AL-04), where "Open request record" would lead back to the same page. */
  onRecord?: boolean;
};

// The way into an adoption's details (AL-06): from the alumni profile as its Furparent reads it (AL-05), from the
// adopted pets on the Furparent's own Home Profile (PR-11), and from the Adopted request (AL-04). Each button owns
// its dialog, so focus returns to where it was opened from. The API answers only the two sides of the adoption and
// admins, whoever sees a button (SEC-FE-05).
export function AdoptionDetailsButton({ adoptionId, petName, variant = "secondary", size = "md", named = false, onRecord = false }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant={variant} size={size} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        Adoption details
        {named && <span className="sr-only"> for {petName}</span>}
      </Button>
      <AdoptionDetailsDialog open={open} onClose={() => setOpen(false)} adoptionId={adoptionId} petName={petName} onRecord={onRecord} />
    </>
  );
}
