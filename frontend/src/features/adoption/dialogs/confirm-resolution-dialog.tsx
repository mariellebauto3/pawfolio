"use client";

import { type ReactNode, useState } from "react";
import { Alert } from "@/components/feedback/alert";
import { Modal } from "@/components/overlays/modal";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { StatusBadge } from "@/components/ui/status-badge";
import { RESOLUTION_ACTION_LABELS } from "@/constants/adoption-resolutions";
import { PET_STATUS_NAMES } from "@/constants/pets";
import type { StatusName } from "@/constants/status-badges";
import { REQUEST_STATUS_LABELS } from "@/constants/statuses";
import { api } from "@/lib/api/client";
import { type FieldErrors, isApiError } from "@/lib/api/errors";
import { applyResolution } from "../api/resolutions";
import { changeEffects } from "../schemas/resolutions";
import type { ResolutionChange, ResolutionInput } from "../types/resolutions";

type Props = {
  /** What the API said the action would change. The dialog is open while there is one. */
  change: ResolutionChange | null;
  petId: number;
  input: ResolutionInput;
  reason: string;
  /** Back to the form, with everything typed still in it. */
  onClose: () => void;
  /** The change was applied; the dialog has closed. */
  onApplied: () => void;
  /** The API refused it (409): the pet or the request moved on. The dialog has closed; the form shows the message. */
  onRefused: (message: string) => void;
  /** The API refused a field (422): the dialog has closed and the form shows the message under it. */
  onInvalid: (errors: FieldErrors) => void;
};

const UNKNOWN_PROBLEM = "That didn't go through. Check your connection and try again.";

/** A status before and after, as the two badges it is on every other screen; one badge when it stays as it is. */
function Transition({ before, after }: { before: StatusName; after: StatusName }) {
  if (before === after) {
    return (
      <span className="flex flex-wrap items-center gap-2">
        <StatusBadge status={before} />
        <span className="text-ink-muted">stays as it is</span>
      </span>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-2">
      <StatusBadge status={before} />
      <Icon name="chevron-right" className="size-4 shrink-0 text-ink-muted" />
      <span className="sr-only">becomes</span>
      <StatusBadge status={after} />
    </span>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-ink-muted">{label}</dt>
      <dd className="min-w-0 wrap-break-word">{children}</dd>
    </>
  );
}

export function ConfirmResolutionDialog(props: Props) {
  // Mounted only while there is a change to confirm, so a failed try doesn't linger into the next one.
  return props.change ? <Confirmation {...props} change={props.change} /> : null;
}

// AL-08 Confirm status change: exactly what the action changes, before it is applied (FR37). The statuses shown are
// the API's own answer to the preview, not worked out here; applying sends the action and the reason again, and the
// API checks them against the pet as it stands then. Every override is logged with who, when and why (NFR9).
function Confirmation({ change, petId, input, reason, onClose, onApplied, onRefused, onInvalid }: Props & { change: ResolutionChange }) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const effects = changeEffects(change);

  async function apply() {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    try {
      await applyResolution(api, petId, { ...input, reason });
      onClose();
      onApplied();
    } catch (failure) {
      setBusy(false);
      if (!isApiError(failure)) return setProblem(UNKNOWN_PROBLEM);
      if (failure.kind === "conflict") {
        onClose();
        return onRefused(failure.message);
      }
      if (failure.kind === "validation") {
        onClose();
        return onInvalid(failure.fieldErrors);
      }
      setProblem(failure.message);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Confirm status change"
      subtitle={`${RESOLUTION_ACTION_LABELS[change.action]}. This overrides the normal flow.`}
      dismissible={!busy}
      closeOnBackdrop={false}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Back
          </Button>
          <Button variant="primary" onClick={apply} loading={busy} loadingLabel="Applying the change">
            Apply change
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {problem && (
          <Alert tone="error" announce>
            {problem}
          </Alert>
        )}

        <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-4 gap-y-3 text-sm">
          <Row label="Pet">
            <span className="font-bold">{change.pet_name}</span>
          </Row>
          <Row label="Pet status">
            <Transition before={PET_STATUS_NAMES[change.before.pet_status]} after={PET_STATUS_NAMES[change.after.pet_status]} />
          </Row>
          {change.request && change.before.request_status && change.after.request_status && (
            <Row label={`Request to ${change.request.home_name ?? "the home"}`}>
              <Transition before={REQUEST_STATUS_LABELS[change.before.request_status]} after={REQUEST_STATUS_LABELS[change.after.request_status]} />
            </Row>
          )}
          <Row label="Reason">
            {/* The admin's own words, as text (SEC-FE-01). */}
            <span className="whitespace-pre-line">{reason}</span>
          </Row>
        </dl>

        {effects.length > 0 && (
          <div className="flex flex-col gap-1 rounded-card bg-surface-sunken p-3 text-sm">
            <p className="font-bold">This also happens</p>
            <ul className="list-disc pl-5">
              {effects.map((effect) => (
                <li key={effect}>{effect}</li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-sm text-ink-muted">Both accounts are notified and read your reason. The change is written to the activity log with your name.</p>
      </div>
    </Modal>
  );
}
