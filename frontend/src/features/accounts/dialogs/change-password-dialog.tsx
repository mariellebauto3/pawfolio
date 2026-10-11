"use client";

import { type FormEvent, useId, useState } from "react";
import { Alert } from "@/components/feedback/alert";
import { Field } from "@/components/forms/field";
import { NewPasswordGuide } from "@/components/forms/new-password-guide";
import { PasswordInput } from "@/components/forms/password-input";
import { Modal } from "@/components/overlays/modal";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import { type FieldErrors, isApiError } from "@/lib/api/errors";
import { changePassword } from "../api/settings";
import { passwordProblems } from "../schemas/accounts";

type Props = {
  open: boolean;
  onClose: () => void;
  /** The password is changed and the dialog has closed. The caller confirms with a toast. */
  onChanged: () => void;
};

const UNKNOWN_PROBLEM = "That didn't go through. Check your connection and try again.";

export function ChangePasswordDialog(props: Props) {
  // Mounted only while open, so no password stays in memory after the dialog closes.
  return props.open ? <ChangePasswordForm {...props} /> : null;
}

// AC-04 Change password: the current one, the new one twice, and what follows. The API checks the current password,
// holds the new one to the sign-up rules and refuses one known from a data leak (SEC-AUTH-03), then signs out every
// other device and keeps this one (SEC-AUTH-07). The three values live in this form's state only and are never
// logged or stored.
function ChangePasswordForm({ onClose, onChanged }: Props) {
  const guideId = useId();
  const [values, setValues] = useState({ current_password: "", password: "", password_confirmation: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (name: keyof typeof values) => (event: { target: { value: string } }) => {
    setValues((current) => ({ ...current, [name]: event.target.value }));
    setErrors((current) => ({ ...current, [name]: "" }));
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const found = passwordProblems(values);
    if (Object.keys(found).length) return setErrors(found);

    setBusy(true);
    setProblem(null);
    try {
      await changePassword(api, values);
      onClose();
      onChanged();
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
      title="Change password"
      subtitle="Other devices will be signed out. You stay signed in here."
      dismissible={!busy}
      closeOnBackdrop={false}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={busy} loadingLabel="Updating your password">
            Update password
          </Button>
        </>
      }
    >
      <Field label="Current password" error={errors.current_password || undefined} required>
        <PasswordInput name="current_password" autoComplete="current-password" value={values.current_password} onChange={set("current_password")} disabled={busy} />
      </Field>
      <Field label="New password" error={errors.password || undefined} required>
        <PasswordInput name="password" autoComplete="new-password" value={values.password} onChange={set("password")} aria-describedby={guideId} disabled={busy} />
      </Field>
      <NewPasswordGuide id={guideId} password={values.password} />
      <Field label="Confirm new password" error={errors.password_confirmation || undefined} required>
        <PasswordInput name="password_confirmation" autoComplete="new-password" value={values.password_confirmation} onChange={set("password_confirmation")} disabled={busy} />
      </Field>
      {problem && (
        <Alert tone="error" announce>
          {problem}
        </Alert>
      )}
    </Modal>
  );
}
