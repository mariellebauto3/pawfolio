"use client";

import { type FormEvent, useState } from "react";
import { Alert } from "@/components/feedback/alert";
import { Field } from "@/components/forms/field";
import { Textarea } from "@/components/forms/textarea";
import { Modal } from "@/components/overlays/modal";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import { formatMeetingTime } from "@/lib/utils/format-date";
import type { MeetGreetSlot } from "@/types/meet-and-greet";
import { rescheduleMeeting } from "../api/meetings";
import { SlotChoices } from "../components/slot-choices";
import { useMeetChange } from "../hooks/use-meet-change";
import { MEET_NOTE_MAX, meetNote, validateMeetNote } from "../schemas/meetings";
import { slotPlace } from "../schemas/slots";

type Props = {
  open: boolean;
  onClose: () => void;
  requestId: number;
  homeName: string;
  /** The slot booked now. */
  current: MeetGreetSlot;
  /** The home's other open slots, soonest first. */
  slots: MeetGreetSlot[];
  /** The human already confirmed the current slot: moving it calls a scheduled meeting off until they confirm again. */
  confirmed: boolean;
  /** The booking moved. The dialog has closed; the caller confirms with a toast and shows where it stands. */
  onRescheduled: (slot: MeetGreetSlot) => void;
};

const UNKNOWN_PROBLEM = "We couldn't move your booking. Check your connection and try again.";

// MG-09 Reschedule Meet & Greet, and "Change slot" on a booking that isn't confirmed yet (MG-04): the pet picks
// another of the home's open slots, with an optional reason (FR26). The human confirms the new time. The API
// decides whether the slot can still be taken (SEC-FE-05).
export function RescheduleDialog(props: Props) {
  // Mounted only while open, so every visit starts with nothing chosen or typed.
  return props.open ? <RescheduleDialogContent {...props} /> : null;
}

function RescheduleDialogContent({ onClose, requestId, homeName, current, slots, confirmed, onRescheduled }: Props) {
  const [picked, setPicked] = useState("");
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [slotError, setSlotError] = useState<string | null>(null);
  const { busy, problem, setProblem, run } = useMeetChange(UNKNOWN_PROBLEM);
  // A slot that left the list while the dialog was open is no longer a choice.
  const chosen = slots.find((slot) => String(slot.id) === picked) ?? null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSlotError(chosen ? null : "Choose one of the open slots.");
    const found = validateMeetNote(reason, "reason");
    setReasonError(found);
    if (!chosen || found) return;

    const done = await run(
      () => rescheduleMeeting(api, requestId, { slotId: chosen.id, reason: meetNote(reason) }),
      (fields, message) => {
        setSlotError(fields.slot_id ?? null);
        setReasonError(fields.reason ?? null);
        if (!fields.slot_id && !fields.reason) setProblem(message);
      },
    );
    if (!done) return;
    onClose();
    onRescheduled(chosen);
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={confirmed ? "Reschedule Meet & Greet" : "Change slot"}
      subtitle={`Currently: ${formatMeetingTime(current.starts_at)} at ${slotPlace(current)}`}
      dismissible={!busy}
      closeOnBackdrop={false}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={slots.length === 0} loading={busy} loadingLabel="Moving your booking">
            Request this time
          </Button>
        </>
      }
    >
      {slots.length === 0 ? (
        <Alert tone="info" title={`${homeName} has no other open slots right now`}>
          Your booking stays as it is. Check again later.
        </Alert>
      ) : (
        <>
          <SlotChoices legend="New time" slots={slots} value={chosen ? picked : ""} onChange={setPicked} error={slotError} disabled={busy} />

          <Field label="Reason" optional error={reasonError} hint={`${homeName} reads this with the new time.`}>
            <Textarea
              name="reason"
              rows={2}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={MEET_NOTE_MAX}
              placeholder="e.g. My caretaker has a vet appointment that day."
              readOnly={busy}
            />
          </Field>

          <p className="text-sm text-ink-muted">
            {homeName} must confirm the new time.
            {confirmed && " Until then the meeting isn’t scheduled, and contact details are hidden again."}
          </p>
        </>
      )}

      {problem && (
        <Alert tone="error" announce>
          {problem}
        </Alert>
      )}
    </Modal>
  );
}
