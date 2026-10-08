"use client";

import { type FormEvent, useState } from "react";
import { Alert } from "@/components/feedback/alert";
import { Field } from "@/components/forms/field";
import { Select } from "@/components/forms/select";
import { Textarea } from "@/components/forms/textarea";
import { Modal } from "@/components/overlays/modal";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import { formatMeetingTime } from "@/lib/utils/format-date";
import type { CancelReason, MeetGreetSlot } from "@/types/meet-and-greet";
import { cancelMeeting } from "../api/meetings";
import { useMeetChange } from "../hooks/use-meet-change";
import { CANCEL_REASONS, CANCEL_REASON_LABELS, MEET_NOTE_MAX, meetNote, validateMeetNote } from "../schemas/meetings";
import { slotPlace } from "../schemas/slots";

type Props = {
  open: boolean;
  onClose: () => void;
  requestId: number;
  /** The meeting being called off. */
  slot: MeetGreetSlot;
  /** Who is told: "Ana Santos", or "Mochi’s caretaker". */
  otherSide: string;
  /** The meeting is cancelled. The dialog has closed; the caller confirms with a toast and shows where it stands. */
  onCancelled: () => void;
};

const UNKNOWN_PROBLEM = "We couldn't cancel the meeting. Check your connection and try again.";
const REASONS = CANCEL_REASONS.map((value) => ({ value, label: CANCEL_REASON_LABELS[value] }));

// MG-10 Cancel the Meet & Greet, from either side (FR11, FR26). The reason is required: the button stays off until
// one is chosen, and the other side reads it. Booking reopens, so the request goes on. The API decides whether
// there is still a meeting to cancel (SEC-FE-05).
export function CancelMeetingDialog(props: Props) {
  // Mounted only while open, so every visit starts with nothing chosen or typed.
  return props.open ? <CancelMeetingDialogContent {...props} /> : null;
}

function CancelMeetingDialogContent({ onClose, requestId, slot, otherSide, onCancelled }: Props) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const { busy, problem, setProblem, run } = useMeetChange(UNKNOWN_PROBLEM);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (reason === "") return;
    const found = validateMeetNote(details, "details");
    setDetailsError(found);
    if (found) return;

    const done = await run(
      () => cancelMeeting(api, requestId, { reason: reason as CancelReason, details: meetNote(details) }),
      (fields, message) => (fields.details ? setDetailsError(fields.details) : setProblem(fields.reason ?? message)),
    );
    if (!done) return;
    onClose();
    onCancelled();
  }

  return (
    <Modal
      open
      onClose={onClose}
      role="alertdialog"
      title="Cancel the Meet & Greet?"
      subtitle={`${formatMeetingTime(slot.starts_at)} at ${slotPlace(slot)}`}
      dismissible={!busy}
      closeOnBackdrop={false}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Keep meeting
          </Button>
          <Button type="submit" variant="destructive" disabled={reason === ""} loading={busy} loadingLabel="Cancelling the meeting">
            Cancel meeting
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <p className="text-sm font-bold">What happens</p>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm marker:text-ink-subtle">
          <li>{otherSide} is notified, with your reason.</li>
          <li>The request stays Approved, and booking reopens so a new time can be picked.</li>
          <li>Contact details are hidden again until a new meeting is confirmed.</li>
        </ul>
      </div>

      <Field label="Reason" required hint="Choose one to continue.">
        <Select
          name="reason"
          options={REASONS}
          placeholder="Choose a reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          disabled={busy}
        />
      </Field>

      <Field label="Details" optional error={detailsError}>
        <Textarea
          name="details"
          rows={3}
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          maxLength={MEET_NOTE_MAX}
          placeholder="Tell the other side what happened."
          readOnly={busy}
        />
      </Field>

      {problem && (
        <Alert tone="error" announce>
          {problem}
        </Alert>
      )}
    </Modal>
  );
}
