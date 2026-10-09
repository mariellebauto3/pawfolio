"use client";

import { type FormEvent, useState } from "react";
import { Alert } from "@/components/feedback/alert";
import { Field } from "@/components/forms/field";
import { Textarea } from "@/components/forms/textarea";
import { Modal } from "@/components/overlays/modal";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { REQUEST_COOLDOWN_DAYS } from "@/constants/adoption-requests";
import { api } from "@/lib/api/client";
import { declineAfterMeeting } from "../api/meetings";
import { useMeetChange } from "../hooks/use-meet-change";
import { MEET_NOTE_MAX, meetNote, validateMeetNote } from "../schemas/meetings";

type Props = {
  open: boolean;
  onClose: () => void;
  requestId: number;
  petName: string;
  /** The request is Not Adopted. The dialog has closed; the caller confirms with a toast and shows where it stands. */
  onDeclined: () => void;
  /**
   * The API says the decision isn't open any more (decided in another tab, or the pet withdrew). The page is read
   * again and this dialog goes with the old panel, so the caller says why.
   */
  onStale: (message: string) => void;
};

const UNKNOWN_PROBLEM = "We couldn't record your decision. Check your connection and try again.";

// MG-14 Decline after the meeting: the human met the pet and says no (FR12). It ends the request for good as Not
// Adopted, frees the pet, and starts the 30-day wait before it may apply to this home again, so it asks first and
// says so. Only the optional message is sent; the API decides whether the decision is still open (SEC-FE-05).
export function DeclineAfterMeetingDialog(props: Props) {
  // Mounted only while open, so every visit starts with nothing typed.
  return props.open ? <DeclineAfterMeetingDialogContent {...props} /> : null;
}

function DeclineAfterMeetingDialogContent({ onClose, requestId, petName, onDeclined, onStale }: Props) {
  const [message, setMessage] = useState("");
  const [messageError, setMessageError] = useState<string | null>(null);
  const { busy, problem, setProblem, run } = useMeetChange(UNKNOWN_PROBLEM, onStale);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = validateMeetNote(message, "message");
    setMessageError(found);
    if (found) return;

    const done = await run(
      () => declineAfterMeeting(api, requestId, meetNote(message)),
      (fields, said) => (fields.decision_message ? setMessageError(fields.decision_message) : setProblem(said)),
    );
    if (!done) return;
    onClose();
    onDeclined();
  }

  return (
    <Modal
      open
      onClose={onClose}
      role="alertdialog"
      title={`Decline ${petName} after the meeting?`}
      subtitle="This ends the request. It can’t be reopened."
      dismissible={!busy}
      closeOnBackdrop={false}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="destructive" loading={busy} loadingLabel="Declining">
            Decline
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <p className="text-sm font-bold">What happens</p>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm marker:text-ink-subtle">
          <li>The request ends as Not Adopted.</li>
          <li>{petName} goes back to Looking for a Home, and its paused requests are sent again.</li>
          <li>Contact details are hidden again.</li>
        </ul>
      </div>

      <Field label={`Message to ${petName}’s caretaker`} optional error={messageError} hint="A kind note helps after the trip to meet you.">
        <Textarea
          name="decision_message"
          rows={3}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          maxLength={MEET_NOTE_MAX}
          placeholder={`Thank you for bringing ${petName}. We don’t think our home is the right fit.`}
          readOnly={busy}
        />
      </Field>

      <p className="flex items-start gap-2 text-sm text-ink-muted">
        <Icon name="clock" className="mt-0.5 size-4 shrink-0" />
        {petName} can’t send you another request for {REQUEST_COOLDOWN_DAYS} days.
      </p>

      {problem && (
        <Alert tone="error" announce>
          {problem}
        </Alert>
      )}
    </Modal>
  );
}
