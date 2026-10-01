"use client";

import { type FormEvent, type ReactNode, useState } from "react";
import { Alert } from "@/components/feedback/alert";
import { Checkbox } from "@/components/forms/checkbox";
import { Field } from "@/components/forms/field";
import { Textarea } from "@/components/forms/textarea";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Modal } from "./modal";

type Reason = {
  /** "Reason for suspending", "Note for the log". */
  label: string;
  /** Who will read it, e.g. "The account owner sees this reason." Defaults to "Required to continue." */
  hint?: ReactNode;
  placeholder?: string;
  /** Characters needed after trimming. Default 1. The API checks again (SEC-INPUT-05). */
  minLength?: number;
  maxLength?: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Names the action: "Withdraw request", "Suspend account". Never "OK". */
  confirmLabel: string;
  cancelLabel?: string;
  /** Red confirm button, for actions that remove or end something. */
  destructive?: boolean;
  /** What will happen, listed in the body (ui-guidelines §5). */
  consequences?: ReactNode[];
  /** Adds "This is permanent." for actions that can't be undone. */
  permanent?: boolean;
  /** Required reason (deny, suspend, cancel meeting, resolve issue). The confirm button stays disabled until filled. */
  reason?: Reason;
  /** A checkbox the user must tick first, e.g. "I understand the owner won't be able to sign in." */
  acknowledgement?: string;
  /** Runs the action. Resolve to close the dialog; throw to keep it open with a retry message. */
  onConfirm: (input: { reason?: string }) => void | Promise<void>;
  children?: ReactNode;
};

// Confirmation for important or irreversible actions (Adopt, Withdraw, Deactivate, Suspend, Delete post).
// Focus starts on the reason field when there is one, otherwise on Cancel, the least destructive choice.
export function ConfirmDialog(props: Props) {
  // Mounted only while open, so the reason and checkbox start empty every time.
  return props.open ? <ConfirmDialogContent {...props} /> : null;
}

function ConfirmDialogContent({
  onClose,
  title,
  subtitle,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = false,
  consequences,
  permanent = false,
  reason,
  acknowledgement,
  onConfirm,
  children,
}: Props) {
  const [text, setText] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const reasonDone = !reason || text.trim().length >= (reason.minLength ?? 1);
  const ready = reasonDone && (!acknowledgement || acknowledged);
  const holdsInput = Boolean(reason || acknowledgement);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await onConfirm({ reason: reason ? text.trim() : undefined });
      onClose();
    } catch {
      // The caller handles logging; the user gets a plain message and keeps what they typed.
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      role="alertdialog"
      title={title}
      subtitle={subtitle}
      dismissible={!busy}
      closeOnBackdrop={!holdsInput}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            type="submit"
            variant={destructive ? "destructive" : "primary"}
            disabled={!ready}
            loading={busy}
            loadingLabel={`${confirmLabel} in progress`}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}

      {consequences && consequences.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-bold">What happens</p>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm marker:text-ink-subtle">
            {consequences.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {permanent && (
        <p className="flex items-center gap-2 text-sm font-bold text-danger">
          <Icon name="triangle-alert" className="size-4 shrink-0" />
          This is permanent. It can&apos;t be undone.
        </p>
      )}

      {reason && (
        <Field label={reason.label} hint={reason.hint ?? "Required to continue."} required>
          <Textarea
            name="reason"
            rows={3}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={reason.placeholder}
            maxLength={reason.maxLength ?? 500}
            disabled={busy}
          />
        </Field>
      )}

      {acknowledgement && (
        <Checkbox
          label={acknowledgement}
          checked={acknowledged}
          onChange={(event) => setAcknowledged(event.target.checked)}
          disabled={busy}
        />
      )}

      {failed && (
        <Alert tone="error" announce>
          That didn&apos;t go through. Check your connection and try again.
        </Alert>
      )}
    </Modal>
  );
}
