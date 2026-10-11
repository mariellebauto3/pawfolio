"use client";

import { type FormEvent, useState } from "react";
import { Alert } from "@/components/feedback/alert";
import { Field } from "@/components/forms/field";
import { Select } from "@/components/forms/select";
import { Textarea } from "@/components/forms/textarea";
import { Modal } from "@/components/overlays/modal";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { REQUEST_COOLDOWN_DAYS } from "@/constants/adoption-requests";
import { api } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { DeclineReason } from "@/types/adoption-request";
import { declineRequest } from "../api/requests";
import { ANSWER_MESSAGE_MAX, DECLINE_REASON_LABELS, answerMessage, validateAnswerMessage } from "../schemas/requests";

type Props = {
  open: boolean;
  onClose: () => void;
  request: { id: number; petName: string };
  /** The request is declined. The dialog has closed; the caller confirms with a toast and shows where it stands. */
  onDeclined: () => void;
  /** The API says it can't be declined any more: nothing changed, and the page behind is out of date. */
  onStale: () => void;
};

const UNKNOWN_PROBLEM = "We couldn't decline the request. Check your connection and try again.";
const NO_REASON = "";
const REASONS = [
  { value: NO_REASON, label: "No reason given" },
  ...(Object.keys(DECLINE_REASON_LABELS) as DeclineReason[]).map((value) => ({ value, label: DECLINE_REASON_LABELS[value] })),
];

// RQ-13 Decline request: the human says no (FR10). It ends the request for good and starts the 30-day wait before
// the pet may apply to this home again, so it asks first and says so. Only the optional reason and message are
// sent; the API decides whether the request can still be declined (SEC-FE-05).
export function DeclineRequestDialog(props: Props) {
  // Mounted only while open, so every visit starts with nothing chosen or typed.
  return props.open ? <DeclineRequestDialogContent {...props} /> : null;
}

function DeclineRequestDialogContent({ onClose, request, onDeclined, onStale }: Props) {
  const [reason, setReason] = useState<string>(NO_REASON);
  const [message, setMessage] = useState("");
  const [messageError, setMessageError] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pet = request.petName;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setProblem(null);

    const found = validateAnswerMessage(message);
    setMessageError(found);
    if (found) return;

    setBusy(true);
    try {
      await declineRequest(api, request.id, { reason: reason === NO_REASON ? null : (reason as DeclineReason), message: answerMessage(message) });
      onClose();
      onDeclined();
    } catch (failure) {
      setBusy(false);
      if (!isApiError(failure)) return setProblem(UNKNOWN_PROBLEM);
      if (failure.kind === "validation") {
        const field = failure.fieldErrors.decision_message;
        return field ? setMessageError(field) : setProblem(failure.fieldErrors.decline_reason ?? failure.message);
      }
      // Answered already, withdrawn or expired: the page should show that.
      if (failure.kind === "conflict") onStale();
      setProblem(failure.kind === "not_found" ? "This request isn’t available any more." : failure.message);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      role="alertdialog"
      title={`Decline ${pet}’s request?`}
      subtitle="This ends the request. It can’t be reopened."
      dismissible={!busy}
      closeOnBackdrop={false}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="destructive" loading={busy} loadingLabel="Declining the request">
            Decline request
          </Button>
        </>
      }
    >
      <Field label="Reason" optional hint={`${pet} sees the reason you choose.`}>
        <Select name="decline_reason" options={REASONS} value={reason} onChange={(event) => setReason(event.target.value)} disabled={busy} />
      </Field>

      <Field label={`Message to ${pet}`} optional error={messageError} hint="A kind note helps the pet’s caretaker.">
        <Textarea
          name="decision_message"
          rows={3}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          maxLength={ANSWER_MESSAGE_MAX}
          readOnly={busy}
        />
      </Field>

      <p className="flex items-start gap-2 text-sm text-ink-muted">
        <Icon name="clock" className="mt-0.5 size-4 shrink-0" />
        {pet} can’t send you another request for {REQUEST_COOLDOWN_DAYS} days.
      </p>

      {problem && (
        <Alert tone="error" announce>
          {problem}
        </Alert>
      )}
    </Modal>
  );
}
