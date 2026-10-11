"use client";

import { type FormEvent, useState } from "react";
import { Alert } from "@/components/feedback/alert";
import { Field } from "@/components/forms/field";
import { RadioCards } from "@/components/forms/radio-cards";
import { Textarea } from "@/components/forms/textarea";
import { Modal } from "@/components/overlays/modal";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import { type FieldErrors, isApiError } from "@/lib/api/errors";
import type { ReportReason, ReportTarget } from "@/types/report";
import { submitReport } from "../api/reports";
import { REPORT_DETAILS_MAX, REPORT_REASON_OPTIONS, isReportReason, reportProblems, reportTitle } from "../schemas/reports";

/** How a report ended without being filed: someone got there first, or there is nothing left to report. */
export type ReportOutcome = "already-reported" | "gone";

type Props = {
  /** What is being reported; null keeps the dialog closed. */
  target: ReportTarget | null;
  onClose: () => void;
  /** The report is filed and the dialog has closed. The caller confirms with a toast (RP-02). */
  onSent: () => void;
  /** Nothing was filed, for a reason worth telling. The dialog has closed; the caller says why with `message`. */
  onSettled: (outcome: ReportOutcome, message: string) => void;
};

const UNKNOWN_PROBLEM = "That didn't go through. Check your connection and try again.";

export function ReportDialog(props: Props) {
  // Mounted only while open, so the reason and the details start empty every time.
  return props.target ? <ReportForm {...props} target={props.target} /> : null;
}

// RP-01 Report dialog (FR16, FR32): why, and anything that helps an admin see it. The screens offer Report only on
// what isn't the reader's own, and the API checks again: its "that's yours" answer arrives under `target_id` and is
// shown here like any other problem (SEC-FE-05). Who is reporting is the session's, never sent.
function ReportForm({ target, onClose, onSent, onSettled }: Props & { target: ReportTarget }) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const needsDetails = reason === "something_else";
  const ready = reason !== null && Object.keys(reportProblems({ reason, details })).length === 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || reason === null) return;
    const found = reportProblems({ reason, details });
    if (Object.keys(found).length) return setErrors(found);

    setBusy(true);
    setProblem(null);
    try {
      await submitReport(api, target, { reason, details: details.trim() || null });
      onClose();
      onSent();
    } catch (failure) {
      setBusy(false);
      if (!isApiError(failure)) return setProblem(UNKNOWN_PROBLEM);
      if (failure.kind === "validation") {
        setErrors(failure.fieldErrors);
        // The target isn't a field of this form: "You cannot report your own content or account." is said in full.
        return setProblem(failure.fieldErrors.target_id ?? null);
      }
      if (failure.kind === "conflict") {
        onClose();
        return onSettled("already-reported", failure.message);
      }
      if (failure.kind === "not_found") {
        onClose();
        return onSettled("gone", "That is no longer on Pawfolio, so there is nothing to report.");
      }
      setProblem(failure.message);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={reportTitle(target)}
      subtitle="Reports are confidential. An admin reviews every report."
      size="lg"
      dismissible={!busy}
      closeOnBackdrop={false}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={!ready} loading={busy} loadingLabel="Sending your report">
            Submit report
          </Button>
        </>
      }
    >
      <RadioCards
        legend="Why are you reporting this?"
        name="reason"
        options={REPORT_REASON_OPTIONS}
        columns={2}
        value={reason ?? ""}
        onChange={(value) => {
          if (!isReportReason(value)) return;
          setReason(value);
          setErrors({});
        }}
        error={errors.reason}
        required
        disabled={busy}
      />
      <Field
        label="Details"
        hint={needsDetails ? "Say what is wrong, so an admin knows what to look for." : "Anything that helps the admin understand the problem."}
        error={errors.details}
        required={needsDetails}
        optional={!needsDetails}
      >
        <Textarea
          name="details"
          rows={3}
          value={details}
          onChange={(event) => {
            setDetails(event.target.value);
            setErrors({});
          }}
          maxLength={REPORT_DETAILS_MAX}
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
