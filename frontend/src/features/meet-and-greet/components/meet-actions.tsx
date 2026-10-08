"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatMeetingTime } from "@/lib/utils/format-date";
import { useToast } from "@/providers/toast-provider";
import type { MeetGreetSlot } from "@/types/meet-and-greet";
import { CancelMeetingDialog } from "../dialogs/cancel-meeting-dialog";
import { ConfirmBookingDialog } from "../dialogs/confirm-booking-dialog";
import { ProposeTimeDialog } from "../dialogs/propose-time-dialog";
import { RescheduleDialog } from "../dialogs/reschedule-dialog";
import type { MeetReader } from "../schemas/meetings";

type Props = {
  reader: MeetReader;
  /** `booked`: waiting for the human to confirm. `scheduled`: confirmed. */
  stage: "booked" | "scheduled";
  requestId: number;
  petName: string;
  homeName: string;
  /** The slot booked now. */
  current: MeetGreetSlot;
  /** The home's other open slots, to move to or to offer instead. */
  slots: MeetGreetSlot[];
};

type Open = "confirm" | "propose" | "reschedule" | "cancel" | null;

// What each side can do with a booking (FR11, FR26). The pet changes its slot while it waits (MG-04), and
// reschedules or cancels once it is confirmed (MG-08, MG-09, MG-10). The human confirms or proposes another time
// (MG-05, MG-06), and afterwards reschedules by proposing, or cancels (MG-07, MG-10). Each opens its dialog; once
// the API has taken the change, the page is read again so the panel, the path and the history follow, and a toast
// confirms, since a toast can't be seen while a dialog is open. The API decides what is still possible, whatever
// is on the screen (SEC-FE-05).
export function MeetActions({ reader, stage, requestId, petName, homeName, current, slots }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState<Open>(null);
  const close = () => setOpen(null);
  const confirmed = stage === "scheduled";

  function changed(message: string) {
    toast.show(message);
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-wrap gap-3">
        {reader === "human" && stage === "booked" && (
          <Button variant="primary" aria-haspopup="dialog" onClick={() => setOpen("confirm")}>
            Confirm
          </Button>
        )}
        {reader === "human" ? (
          <Button aria-haspopup="dialog" onClick={() => setOpen("propose")}>
            {confirmed ? "Reschedule" : "Propose another time"}
          </Button>
        ) : (
          <Button aria-haspopup="dialog" onClick={() => setOpen("reschedule")}>
            {confirmed ? "Reschedule" : "Change slot"}
          </Button>
        )}
        {confirmed && (
          <Button variant="tertiary" aria-haspopup="dialog" onClick={() => setOpen("cancel")}>
            Cancel meeting
          </Button>
        )}
      </div>

      <ConfirmBookingDialog
        open={open === "confirm"}
        onClose={close}
        requestId={requestId}
        petName={petName}
        slot={current}
        onConfirmed={() => changed("Meet & Greet confirmed. Contact details are now shared.")}
      />
      <ProposeTimeDialog
        open={open === "propose"}
        onClose={close}
        requestId={requestId}
        petName={petName}
        current={current}
        slots={slots}
        confirmed={confirmed}
        onProposed={(slot) => changed(`Proposal sent. ${petName} can book ${formatMeetingTime(slot.starts_at)}.`)}
      />
      <RescheduleDialog
        open={open === "reschedule"}
        onClose={close}
        requestId={requestId}
        homeName={homeName}
        current={current}
        slots={slots}
        confirmed={confirmed}
        onRescheduled={(slot) => changed(`Moved to ${formatMeetingTime(slot.starts_at)}. ${homeName} will confirm it.`)}
      />
      <CancelMeetingDialog
        open={open === "cancel"}
        onClose={close}
        requestId={requestId}
        slot={current}
        otherSide={reader === "pet" ? homeName : `${petName}’s caretaker`}
        onCancelled={() => changed("Meeting cancelled. Booking is open again.")}
      />
    </>
  );
}
