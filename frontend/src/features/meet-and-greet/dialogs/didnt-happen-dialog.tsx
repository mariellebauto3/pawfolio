"use client";

import { type FormEvent, useState } from "react";
import { Alert } from "@/components/feedback/alert";
import { Field } from "@/components/forms/field";
import { RadioCards } from "@/components/forms/radio-cards";
import { Textarea } from "@/components/forms/textarea";
import { Modal } from "@/components/overlays/modal";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import { formatMeetingTime } from "@/lib/utils/format-date";
import type { DidntHappenReason, MeetGreetSlot } from "@/types/meet-and-greet";
import { reportDidntHappen } from "../api/meetings";
import { useMeetChange } from "../hooks/use-meet-change";
import { DIDNT_HAPPEN_LABELS, DIDNT_HAPPEN_REASONS, MEET_NOTE_MAX, meetNote, validateMeetNote } from "../schemas/meetings";
import { slotPlace } from "../schemas/slots";

type Props = {
  open: boolean;
  onClose: () => void;
  requestId: number;
  petName: string;
  /** The meeting that didn't take place; null when the API didn't say which. */
  slot: MeetGreetSlot | null;
  /** It is reported. The dialog has closed; the caller confirms with a toast and shows where the request stands. */
  onReported: () => void;
  /**
   * The API says the decision isn't open any more (decided in another tab, or the pet withdrew). The page is read
   * again and this dialog goes with the old panel, so the caller says why.
   */
  onStale: (message: string) => void;
};

const UNKNOWN_PROBLEM = "We couldn't reopen booking. Check your connection and try again.";
const REASONS = DIDNT_HAPPEN_REASONS.map((value) => ({ value, label: DIDNT_HAPPEN_LABELS[value] }));

// MG-13 "It didn't happen": the human reports that the two never met (FR12). Nothing ends: booking reopens, so a
// new time can be picked. What happened is required, since the pet's side reads it; the button waits for it. The
// API decides whether there is still a meeting to report (SEC-FE-05).
export function DidntHappenDialog(props: Props) {
  // Mounted only while open, so every visit starts with nothing chosen or typed.
  return props.open ? <DidntHappenDialogContent {...props} /> : null;
}

function DidntHappenDialogContent({ onClose, requestId, petName, slot, onReported, onStale }: Props) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const { busy, problem, setProblem, run } = useMeetChange(UNKNOWN_PROBLEM, onStale);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (reason === "") return;
    const found = validateMeetNote(details, "details");
    setDetailsError(found);
    if (found) return;

    const done = await run(
      () => reportDidntHappen(api, requestId, { reason: reason as DidntHappenReason, details: meetNote(details) }),
      (fields, message) => (fields.details ? setDetailsError(fields.details) : setProblem(fields.reason ?? message)),
    );
    if (!done) return;
    onClose();
    onReported();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="The meeting didn’t happen?"
      subtitle={slot ? `${formatMeetingTime(slot.starts_at)} at ${slotPlace(slot)}` : "Booking reopens so a new time can be picked."}
      dismissible={!busy}
      closeOnBackdrop={false}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={reason === ""} loading={busy} loadingLabel="Reopening booking">
            Reopen booking
          </Button>
        </>
      }
    >
      <RadioCards legend="What happened" hint="Choose one to continue." required name="reason" options={REASONS} value={reason} onChange={setReason} disabled={busy} />

      <Field label="Details" optional error={detailsError} hint={`${petName}’s caretaker reads what you choose and write.`}>
        <Textarea name="details" rows={2} value={details} onChange={(event) => setDetails(event.target.value)} maxLength={MEET_NOTE_MAX} readOnly={busy} />
      </Field>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-bold">What happens</p>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm marker:text-ink-subtle">
          <li>The request goes back to Approved, and {petName} books a new slot.</li>
          <li>Contact details are hidden again until a new meeting is confirmed.</li>
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
