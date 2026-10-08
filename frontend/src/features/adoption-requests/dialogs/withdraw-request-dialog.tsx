"use client";

import { type FormEvent, useState } from "react";
import { Alert } from "@/components/feedback/alert";
import { Field } from "@/components/forms/field";
import { Select } from "@/components/forms/select";
import { Modal } from "@/components/overlays/modal";
import { Button } from "@/components/ui/button";
import { IN_PROCESS_REQUEST_STATUSES, MAX_OPEN_REQUESTS, REQUEST_EXPIRY_DAYS } from "@/constants/adoption-requests";
import { api } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { AdoptionRequest, WithdrawReason } from "@/types/adoption-request";
import { withdrawRequest } from "../api/requests";
import { WITHDRAW_REASON_LABELS } from "../schemas/requests";

type Props = {
  open: boolean;
  onClose: () => void;
  request: Pick<AdoptionRequest, "id" | "status" | "home_profile">;
  /** The request is withdrawn. The dialog has closed; the caller confirms with a toast and shows where it stands. */
  onWithdrawn: () => void;
  /** The API says it had ended already: nothing was withdrawn, and the page behind is out of date. */
  onStale: () => void;
};

const UNKNOWN_PROBLEM = "We couldn't withdraw your request. Check your connection and try again.";
const NO_REASON = "";
const REASONS = [
  { value: NO_REASON, label: "No reason given" },
  ...(Object.keys(WITHDRAW_REASON_LABELS) as WithdrawReason[]).map((value) => ({ value, label: WITHDRAW_REASON_LABELS[value] })),
];

// RQ-16 Withdraw request: a pet may take a request back at any time before the final decision (FR25). It ends the
// request for good, so it asks first and says what follows. Only the optional reason is sent; the API decides
// whether the request can still be withdrawn, and frees the pet and its requests On Hold when it was the one in
// process (SEC-FE-05).
export function WithdrawRequestDialog(props: Props) {
  // Mounted only while open, so every visit starts with no reason chosen.
  return props.open ? <WithdrawRequestDialogContent {...props} /> : null;
}

function WithdrawRequestDialogContent({ onClose, request, onWithdrawn, onStale }: Props) {
  const [reason, setReason] = useState<string>(NO_REASON);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const homeName = request.home_profile.full_name;
  const inProcess = IN_PROCESS_REQUEST_STATUSES.includes(request.status);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setProblem(null);
    setBusy(true);
    try {
      await withdrawRequest(api, request.id, reason === NO_REASON ? null : (reason as WithdrawReason));
      onClose();
      onWithdrawn();
    } catch (failure) {
      setBusy(false);
      if (!isApiError(failure)) return setProblem(UNKNOWN_PROBLEM);
      if (failure.code === "request_already_closed") onStale();
      setProblem(failure.kind === "not_found" ? "This request isn’t available any more." : failure.message);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      role="alertdialog"
      title={`Withdraw your request to ${homeName}?`}
      subtitle="This ends the request. It can’t be reopened."
      dismissible={!busy}
      closeOnBackdrop={false}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Keep request
          </Button>
          <Button type="submit" variant="destructive" loading={busy} loadingLabel="Withdrawing your request">
            Withdraw request
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <p className="text-sm font-bold">What happens</p>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm marker:text-ink-subtle">
          <li>{homeName} is notified.</li>
          {inProcess ? (
            <>
              <li>Your Meet & Greet with them, if one is booked, is cancelled.</li>
              <li>Your requests On Hold go back to Sent, each with a fresh {REQUEST_EXPIRY_DAYS} days.</li>
            </>
          ) : (
            <li>One of your {MAX_OPEN_REQUESTS} open requests is free again.</li>
          )}
          <li>There is no waiting time: you can apply to this home again later.</li>
        </ul>
      </div>

      <Field label="Reason" optional hint={`${homeName} can read the reason on the request.`}>
        <Select name="withdraw_reason" options={REASONS} value={reason} onChange={(event) => setReason(event.target.value)} disabled={busy} />
      </Field>

      {problem && (
        <Alert tone="error" announce>
          {problem}
        </Alert>
      )}
    </Modal>
  );
}
