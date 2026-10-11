"use client";

import { type FormEvent, useState } from "react";
import { Alert } from "@/components/feedback/alert";
import { Field } from "@/components/forms/field";
import { Textarea } from "@/components/forms/textarea";
import { Modal } from "@/components/overlays/modal";
import { Button } from "@/components/ui/button";
import { REQUEST_EXPIRY_DAYS } from "@/constants/adoption-requests";
import { api } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { approveRequest } from "../api/requests";
import { ANSWER_MESSAGE_MAX, answerMessage, validateAnswerMessage } from "../schemas/requests";

type Props = {
  open: boolean;
  onClose: () => void;
  request: { id: number; petName: string };
  /** The request is approved. The dialog has closed; the caller confirms with a toast and shows where it stands. */
  onApproved: () => void;
  /** The API says it can't be approved any more: nothing changed, and the page behind is out of date. */
  onStale: () => void;
};

const UNKNOWN_PROBLEM = "We couldn't approve the request. Check your connection and try again.";

// RQ-12 Approve request: the human says yes to meeting the pet (FR10). It moves the pet to In Process and pauses
// its other requests, so the dialog says so before it happens. Only the optional message is sent; the API decides
// whether the request can still be approved and makes every status change itself (FR27, SEC-FE-05).
export function ApproveRequestDialog(props: Props) {
  // Mounted only while open, so every visit starts with an empty message.
  return props.open ? <ApproveRequestDialogContent {...props} /> : null;
}

function ApproveRequestDialogContent({ onClose, request, onApproved, onStale }: Props) {
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
      await approveRequest(api, request.id, answerMessage(message));
      onClose();
      onApproved();
    } catch (failure) {
      setBusy(false);
      if (!isApiError(failure)) return setProblem(UNKNOWN_PROBLEM);
      if (failure.kind === "validation") return setMessageError(failure.fieldErrors.approval_message ?? failure.message);
      // No longer Sent, expired, or the pet is with another home: the page should show that.
      if (failure.kind === "conflict") onStale();
      setProblem(failure.kind === "not_found" ? "This request isn’t available any more." : failure.message);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Approve ${pet}’s request?`}
      subtitle={`${pet} moves to In Process and can book one of your Meet & Greet slots.`}
      dismissible={!busy}
      closeOnBackdrop={false}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={busy} loadingLabel="Approving the request">
            Approve request
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <p className="text-sm font-bold">What happens</p>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm marker:text-ink-subtle">
          <li>{pet}’s other open requests go On Hold.</li>
          <li>
            {pet} has {REQUEST_EXPIRY_DAYS} days to book a Meet & Greet. Without a booking, the request expires.
          </li>
          <li>Your address and phone number stay private until you confirm a Meet & Greet.</li>
        </ul>
      </div>

      <Field label={`Message to ${pet}`} optional error={messageError} hint={`${pet} reads this with the approval.`}>
        <Textarea
          name="approval_message"
          rows={3}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          maxLength={ANSWER_MESSAGE_MAX}
          placeholder="e.g. We’d love to meet you! Pick any slot that works."
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
