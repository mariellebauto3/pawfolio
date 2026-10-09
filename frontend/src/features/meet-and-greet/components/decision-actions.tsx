"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/providers/toast-provider";
import type { MeetGreetSlot } from "@/types/meet-and-greet";
import { DeclineAfterMeetingDialog } from "../dialogs/decline-after-meeting-dialog";
import { DidntHappenDialog } from "../dialogs/didnt-happen-dialog";

type Props = {
  requestId: number;
  petName: string;
  /** The meeting the decision is about; null when the API didn't say which. */
  met: MeetGreetSlot | null;
  /** Adopt, from its own module (AL-01): the first and the only filled choice. */
  adopt?: ReactNode;
};

// MG-11: the three things a human can say once the Meet & Greet time has passed (FR12, §5.4): Adopt, Decline, or
// "It didn't happen". They are stacked, most to least final, so the choice is read before it is pressed. Decline
// and "It didn't happen" open their dialogs (MG-14, MG-13); once the API has taken the answer, the page is read
// again so the status, the path and the history follow, and a toast confirms, since a toast can't be seen while a
// dialog is open. The API offers none of them before the meeting time, whatever is on the screen (SEC-FE-05).
export function DecisionActions({ requestId, petName, met, adopt }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState<"decline" | "didnt-happen" | null>(null);
  const close = () => setOpen(null);

  function changed(message: string) {
    toast.show(message);
    router.refresh();
  }

  // The request moved on while the dialog was open. The page is already being read again, and the dialog leaves
  // with these buttons, so the API's own words are said in a toast.
  const stale = (message: string) => toast.show(message, { tone: "error" });

  return (
    <>
      <div className="flex flex-col gap-2">
        {adopt}
        <Button aria-haspopup="dialog" onClick={() => setOpen("decline")}>
          Decline
        </Button>
        <Button variant="tertiary" aria-haspopup="dialog" onClick={() => setOpen("didnt-happen")}>
          It didn’t happen
        </Button>
      </div>

      <DeclineAfterMeetingDialog
        open={open === "decline"}
        onClose={close}
        requestId={requestId}
        petName={petName}
        onDeclined={() => changed(`Declined. ${petName} is Looking for a Home again.`)}
        onStale={stale}
      />
      <DidntHappenDialog
        open={open === "didnt-happen"}
        onClose={close}
        requestId={requestId}
        petName={petName}
        slot={met}
        onReported={() => changed(`Booking is open again. ${petName} can pick a new slot.`)}
        onStale={stale}
      />
    </>
  );
}
