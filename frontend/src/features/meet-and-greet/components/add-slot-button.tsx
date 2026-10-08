"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatMeetingTime } from "@/lib/utils/format-date";
import { useToast } from "@/providers/toast-provider";
import type { MeetGreetSlot } from "@/types/meet-and-greet";
import { AddSlotDialog } from "../dialogs/add-slot-dialog";

type Props = {
  /** Primary on the page header; secondary where it is the next step of an empty list. */
  variant?: "primary" | "secondary";
};

// "Add slot" on the availability page (MG-01). It opens the dialog (MG-02); once the slot is added the list is
// read again and a toast confirms, since a toast can't be seen while a dialog is open.
export function AddSlotButton({ variant = "primary" }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);

  function added(slots: MeetGreetSlot[]) {
    toast.show(slots.length === 1 ? `Slot added for ${formatMeetingTime(slots[0].starts_at)}.` : `${slots.length} weekly slots added.`);
    router.refresh();
  }

  return (
    <>
      <Button variant={variant} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        Add slot
      </Button>
      <AddSlotDialog open={open} onClose={() => setOpen(false)} onAdded={added} />
    </>
  );
}
