"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { HiredDialog } from "../dialogs/hired-dialog";
import type { AdoptionPair } from "../types/adoptions";

// "See what changed" on a pet's Adopted request: it opens "You got Hired" (AL-03), which leads on to the alumni
// profile and to posting an update.
export function HiredButton({ pet, home }: AdoptionPair) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="primary" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        See what changed
      </Button>
      <HiredDialog open={open} onClose={() => setOpen(false)} pet={pet} home={home} />
    </>
  );
}
