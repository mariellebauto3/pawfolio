"use client";

import { type FormEvent, useState } from "react";
import { Alert } from "@/components/feedback/alert";
import { Field } from "@/components/forms/field";
import { RadioCards } from "@/components/forms/radio-cards";
import { Textarea } from "@/components/forms/textarea";
import { Modal } from "@/components/overlays/modal";
import { Button } from "@/components/ui/button";
import { DENIAL_REASON_LABELS } from "@/constants/verification";
import { api } from "@/lib/api/client";
import { type FieldErrors, isApiError } from "@/lib/api/errors";
import { DENIAL_MESSAGE_MAX, denialProblems, isDenialReason } from "@/lib/auth/verification-review";
import type { VerificationReview } from "@/types/verification-review";
import { DENIAL_REASONS, type DenialReason } from "@/types/verification";
import { denyVerification } from "../api/verification-review";

type Props = {
  open: boolean;
  onClose: () => void;
  accountId: number;
  /** The pet's or the human's name, for the title. */
  name: string;
  /** Called with the account as the denial left it, after the dialog has closed. */
  onDenied: (review: VerificationReview) => void;
  /** Another admin decided first (409): the dialog closes and the page shows what they decided. */
  onAlreadyReviewed: (message: string) => void;
};

// A message the admin can send as it is or edit. "Other" has none: the admin writes what to correct.
const SUGGESTED_MESSAGES: Record<DenialReason, string> = {
  id_photo_unreadable: "The ID photo is blurry and the name can't be read. Please upload a clearer photo.",
  name_mismatch: "The name on the account doesn't match the name on the ID. Please correct the name, or upload an ID in the same name.",
  id_expired: "The ID you uploaded has expired. Please upload a valid ID that hasn't expired.",
  under_18: "The ID shows an age under 18. Pawfolio accounts are for people 18 or older.",
  other: "",
};

const REASON_OPTIONS = DENIAL_REASONS.map((reason) => ({ value: reason, label: DENIAL_REASON_LABELS[reason] }));

const UNKNOWN_PROBLEM = "That didn't go through. Check your connection and try again.";

export function DenyAccountDialog(props: Props) {
  // Mounted only while open, so the reason and the message start empty every time.
  return props.open ? <DenyAccountForm {...props} /> : null;
}

// Deny account (AU-25, FR33). A reason is required and the button stays off until one is chosen (ui-guidelines §4);
// the owner reads it, with the message, on their Denied screen (AU-20). The API checks both again and writes the
// decision to the activity log (SEC-AUTHZ-07, SEC-LOG-01).
function DenyAccountForm({ onClose, accountId, name, onDenied, onAlreadyReviewed }: Props) {
  const [reason, setReason] = useState<DenialReason | null>(null);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const input = { denial_reason: reason, message_to_owner: message.trim() || null };
  const ready = reason !== null && Object.keys(denialProblems(input)).length === 0;

  function chooseReason(value: string) {
    if (!isDenialReason(value)) return;
    // The suggestion follows the reason until the admin writes their own message.
    const untouched = !message.trim() || (reason !== null && message === SUGGESTED_MESSAGES[reason]);
    if (untouched) setMessage(SUGGESTED_MESSAGES[value]);
    setReason(value);
    setErrors({});
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || reason === null) return;
    const found = denialProblems(input);
    if (Object.keys(found).length) return setErrors(found);

    setBusy(true);
    setProblem(null);
    try {
      const review = await denyVerification(api, accountId, { ...input, denial_reason: reason });
      onClose();
      onDenied(review);
    } catch (failure) {
      setBusy(false);
      if (!isApiError(failure)) return setProblem(UNKNOWN_PROBLEM);
      if (failure.kind === "validation") return setErrors(failure.fieldErrors);
      if (failure.kind === "conflict") {
        onClose();
        return onAlreadyReviewed(failure.message);
      }
      setProblem(failure.message);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Deny ${name}?`}
      subtitle="The owner sees your reason and can correct their details and resubmit."
      dismissible={!busy}
      closeOnBackdrop={false}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={!ready} loading={busy} loadingLabel="Denying the account">
            Deny account
          </Button>
        </>
      }
    >
      <RadioCards
        legend="Reason"
        name="denial_reason"
        options={REASON_OPTIONS}
        value={reason ?? ""}
        onChange={chooseReason}
        error={errors.denial_reason}
        hint="Required to continue."
        required
        disabled={busy}
      />
      <Field
        label="Message to the owner"
        hint={reason === "other" ? "Say what to correct. “Other” needs a message." : "Shown with the reason on the owner's account screen."}
        error={errors.message_to_owner}
        required={reason === "other"}
        optional={reason !== "other"}
      >
        <Textarea
          name="message_to_owner"
          rows={3}
          value={message}
          onChange={(event) => {
            setMessage(event.target.value);
            setErrors({});
          }}
          maxLength={DENIAL_MESSAGE_MAX}
          disabled={busy}
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
