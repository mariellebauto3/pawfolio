"use client";

import type { FormEvent } from "react";
import { Alert } from "@/components/feedback/alert";
import { Modal } from "@/components/overlays/modal";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import { formatMeetingTime } from "@/lib/utils/format-date";
import type { MeetGreetSlot } from "@/types/meet-and-greet";
import { confirmBooking } from "../api/meetings";
import { useMeetChange } from "../hooks/use-meet-change";
import { slotPlace } from "../schemas/slots";

type Props = {
  open: boolean;
  onClose: () => void;
  requestId: number;
  petName: string;
  /** The slot the pet booked. */
  slot: MeetGreetSlot;
  /** The meeting is scheduled. The dialog has closed; the caller confirms with a toast and shows the meeting. */
  onConfirmed: () => void;
};

const UNKNOWN_PROBLEM = "We couldn't confirm the booking. Check your connection and try again.";

// Confirming a booking (MG-05, FR11) is the moment each side's phone number and the human's exact address are
// shown to the other (NFR4, SEC-PRIV-02). What is seen can't be unseen, so the human reads what is shared before
// agreeing; the LoFi's Confirm button had no such step. The API decides whether the booking can still be confirmed
// (SEC-FE-05).
export function ConfirmBookingDialog(props: Props) {
  // Mounted only while open, so an earlier problem isn't shown again.
  return props.open ? <ConfirmBookingDialogContent {...props} /> : null;
}

function ConfirmBookingDialogContent({ onClose, requestId, petName, slot, onConfirmed }: Props) {
  const { busy, problem, run } = useMeetChange(UNKNOWN_PROBLEM);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!(await run(() => confirmBooking(api, requestId)))) return;
    onClose();
    onConfirmed();
  }

  return (
    <Modal
      open
      onClose={onClose}
      role="alertdialog"
      title="Confirm this Meet & Greet?"
      subtitle={`${formatMeetingTime(slot.starts_at)} at ${slotPlace(slot)}`}
      dismissible={!busy}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Not yet
          </Button>
          <Button type="submit" variant="primary" loading={busy} loadingLabel="Confirming the booking">
            Confirm Meet & Greet
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <p className="text-sm font-bold">What happens</p>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm marker:text-ink-subtle">
          <li>The request becomes Meet Scheduled.</li>
          <li>
            {petName}’s caretaker sees your phone number and exact address. You see the caretaker’s name and phone number.
          </li>
          <li>You both get a reminder 1 day and 1 hour before.</li>
        </ul>
      </div>

      {problem && (
        <Alert tone="error" announce>
          {problem}
        </Alert>
      )}
    </Modal>
  );
}
