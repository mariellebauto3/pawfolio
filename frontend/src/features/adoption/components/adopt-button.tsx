"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/providers/toast-provider";
import { AdoptDialog } from "../dialogs/adopt-dialog";
import type { AdoptionPair } from "../types/adoptions";
import { useAdoptionMoment } from "./adoption-moment";

type Props = AdoptionPair & {
  requestId: number;
};

// Adopt, the first of the human's three choices once the Meet & Greet time has passed (MG-11, FR12). It opens the
// confirmation (AL-01). Once the API has recorded the adoption, the page is read again so the status, the path and
// the history follow, and "You're a Furparent" (AL-02) opens over it. It only shows while the decision is open; the
// API refuses an adoption at any other time, whatever is on the screen (SEC-FE-05).
export function AdoptButton({ requestId, pet, home }: Props) {
  const router = useRouter();
  const toast = useToast();
  const moment = useAdoptionMoment();
  const [open, setOpen] = useState(false);

  function adopted() {
    // Without the celebration around it, a toast still says what happened.
    if (moment) moment.celebrate();
    else toast.show(`You’re a Furparent! ${pet.name} is now Hired and linked to your profile.`);
    router.refresh();
  }

  return (
    <>
      <Button variant="primary" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        Adopt {pet.name}
      </Button>
      <AdoptDialog
        open={open}
        onClose={() => setOpen(false)}
        requestId={requestId}
        pet={pet}
        home={home}
        onAdopted={adopted}
        // The page behind shows a decision that is no longer open. Reading it again takes this button and its dialog
        // away, so the API's own words are said in a toast.
        onStale={(message) => {
          toast.show(message, { tone: "error" });
          router.refresh();
        }}
      />
    </>
  );
}
