"use client";

import { type FormEvent, useState } from "react";
import { Alert } from "@/components/feedback/alert";
import { Field } from "@/components/forms/field";
import { Input } from "@/components/forms/input";
import { PasswordInput } from "@/components/forms/password-input";
import { Select } from "@/components/forms/select";
import { Modal } from "@/components/overlays/modal";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { ROUTES } from "@/constants/routes";
import { api } from "@/lib/api/client";
import { type FieldErrors, isApiError } from "@/lib/api/errors";
import { deactivateOwnAccount } from "../api/settings";
import { DEACTIVATION_REASON_MAX, LEAVING_REASONS, leavingReason } from "../schemas/accounts";

type Props = {
  open: boolean;
  onClose: () => void;
  role: "pet" | "human";
};

const UNKNOWN_PROBLEM = "That didn't go through. Check your connection and try again.";

export function DeactivateAccountDialog(props: Props) {
  // Mounted only while open, so the password and the reason start empty every time.
  return props.open ? <DeactivateAccountForm {...props} /> : null;
}

// AC-05 Deactivate account: the owner closes their own account. It says what happens and that it is permanent
// (only a suspended account can be brought back), asks why, and is confirmed with the password, which the API
// checks. Once it answers, the session is over: the page is replaced by the landing page, so nothing of the
// signed-in account stays in memory.
function DeactivateAccountForm({ onClose, role }: Props) {
  const [choice, setChoice] = useState("");
  const [other, setOther] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!password) return setErrors({ password: "Enter your password to confirm deactivating your account." });

    setBusy(true);
    setProblem(null);
    try {
      await deactivateOwnAccount(api, { password, reason: leavingReason(choice, other) });
      // The dialog stays busy while the landing page loads over it.
      window.location.assign(ROUTES.landing);
    } catch (failure) {
      setBusy(false);
      if (isApiError(failure) && failure.kind === "validation") return setErrors(failure.fieldErrors);
      setProblem(isApiError(failure) ? failure.message : UNKNOWN_PROBLEM);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      role="alertdialog"
      title="Deactivate your account?"
      dismissible={!busy}
      closeOnBackdrop={false}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Keep my account
          </Button>
          <Button type="submit" variant="destructive" disabled={!password} loading={busy} loadingLabel="Deactivating your account">
            Deactivate account
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <p className="text-sm font-bold">What happens</p>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm marker:text-ink-subtle">
          <li>{role === "pet" ? "Your resume is hidden from everyone." : "Your Home Profile is hidden from everyone."}</li>
          <li>Your open adoption requests and their Meet &amp; Greets are closed, and the other side is told.</li>
          <li>Your posts and comments leave the feed.</li>
          <li>Adoption history and activity logs are kept.</li>
          <li>You are signed out on every device and can’t sign in again.</li>
        </ul>
      </div>

      <p className="flex items-center gap-2 text-sm font-bold text-danger">
        <Icon name="triangle-alert" className="size-4 shrink-0" />
        This is permanent. You can’t reactivate the account yourself.
      </p>

      <Field label="Why are you leaving?" optional>
        <Select name="reason" value={choice} onChange={(event) => setChoice(event.target.value)} options={[...LEAVING_REASONS]} placeholder="Choose a reason" disabled={busy} />
      </Field>
      {choice === "Other" && (
        <Field label="Tell us more" error={errors.reason} optional>
          <Input type="text" name="reason_other" value={other} onChange={(event) => setOther(event.target.value)} maxLength={DEACTIVATION_REASON_MAX} disabled={busy} />
        </Field>
      )}

      <Field label="Enter your password to confirm" error={errors.password} required>
        <PasswordInput
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setErrors({});
          }}
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
