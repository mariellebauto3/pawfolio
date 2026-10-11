"use client";

import { type FormEvent, useState } from "react";
import { Alert } from "@/components/feedback/alert";
import { Checkbox } from "@/components/forms/checkbox";
import { Field } from "@/components/forms/field";
import { RadioCards } from "@/components/forms/radio-cards";
import { Textarea } from "@/components/forms/textarea";
import { Modal } from "@/components/overlays/modal";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import { type FieldErrors, isApiError } from "@/lib/api/errors";
import type { ReportAction } from "@/types/report";
import { takeReportAction } from "../api/reports";
import { ACTION_REASON_MAX, type ActionOption, actionProblems, isReportAction } from "../schemas/reports";
import type { ReportDetail } from "../types/reports";

type Props = {
  open: boolean;
  onClose: () => void;
  reportId: number;
  /** "Post by Mochi": what the action is taken on, for the title. */
  itemName: string;
  /** How many open reports the action resolves. */
  reportsCount: number;
  /** What this report offers: a profile has nothing to remove, and only an Active account can be suspended. */
  options: ActionOption[];
  /** Chosen when the dialog opens: nothing from "Choose action…", Dismiss from "Dismiss report". */
  initialAction?: ReportAction;
  /** Called with the report as the action left it, after the dialog has closed. */
  onApplied: (report: ReportDetail, action: ReportAction) => void;
  /** Another admin acted first (409): the dialog closes and the page shows what they decided. */
  onAlreadyResolved: (message: string) => void;
};

const UNKNOWN_PROBLEM = "That didn't go through. Check your connection and try again.";

export function TakeActionDialog(props: Props) {
  // Mounted only while open, so the action and the reason start over every time.
  return props.open ? <TakeActionForm {...props} /> : null;
}

// RP-05 Take action (FR35, FR34): remove, suspend, both, or dismiss, always with a reason. The owner of the item
// reads the reason in their notification unless the report is dismissed; the API requires it and writes the action
// to the activity log (SEC-AUTHZ-07, SEC-LOG-01). One action resolves every open report on the item.
function TakeActionForm({ onClose, reportId, itemName, reportsCount, options, initialAction, onApplied, onAlreadyResolved }: Props) {
  const [action, setAction] = useState<ReportAction | null>(initialAction ?? null);
  const [reason, setReason] = useState("");
  const [notify, setNotify] = useState(true);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const chosen = options.find((option) => option.value === action);
  const ready = chosen !== undefined && Object.keys(actionProblems({ action, reason })).length === 0;
  const dismissing = action === "dismiss";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !chosen) return;
    const found = actionProblems({ action, reason });
    if (Object.keys(found).length) return setErrors(found);

    setBusy(true);
    setProblem(null);
    try {
      const report = await takeReportAction(api, reportId, { action: chosen.value, reason: reason.trim(), notify_reporters: notify });
      onClose();
      onApplied(report, chosen.value);
    } catch (failure) {
      setBusy(false);
      if (!isApiError(failure)) return setProblem(UNKNOWN_PROBLEM);
      if (failure.kind === "validation") return setErrors(failure.fieldErrors);
      if (failure.kind === "conflict") {
        onClose();
        return onAlreadyResolved(failure.message);
      }
      setProblem(failure.message);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Take action on this report"
      subtitle={`${itemName}. Your action resolves ${reportsCount === 1 ? "the open report" : `all ${reportsCount} open reports`} on it.`}
      size="lg"
      dismissible={!busy}
      closeOnBackdrop={false}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant={chosen?.destructive ? "destructive" : "primary"} disabled={!ready} loading={busy} loadingLabel="Applying the action">
            {chosen?.confirmLabel ?? "Apply action"}
          </Button>
        </>
      }
    >
      <RadioCards
        legend="Action"
        name="action"
        options={options}
        value={action ?? ""}
        onChange={(value) => {
          if (!isReportAction(value)) return;
          setAction(value);
          setErrors({});
        }}
        error={errors.action}
        required
        disabled={busy}
      />
      <Field
        label="Reason"
        hint={dismissing ? "Required. Kept in the activity log; the owner isn’t told." : "Required. Shown to the owner, and kept in the activity log."}
        error={errors.reason}
        required
      >
        <Textarea
          name="reason"
          rows={3}
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
            setErrors({});
          }}
          placeholder={dismissing ? "e.g. Reviewed the post. Nothing in it breaks the rules." : "e.g. Selling animals is not allowed on Pawfolio."}
          maxLength={ACTION_REASON_MAX}
          disabled={busy}
        />
      </Field>
      <Checkbox
        name="notify_reporters"
        label={reportsCount === 1 ? "Tell the member who reported it that it was reviewed" : "Tell the members who reported it that it was reviewed"}
        description="They are thanked and told it is resolved, never what was decided."
        checked={notify}
        onChange={(event) => setNotify(event.target.checked)}
        disabled={busy}
      />
      {problem && (
        <Alert tone="error" announce>
          {problem}
        </Alert>
      )}
    </Modal>
  );
}
