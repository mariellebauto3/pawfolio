"use client";

import { type FormEvent, useState } from "react";
import { Alert } from "@/components/feedback/alert";
import { Field } from "@/components/forms/field";
import { Input } from "@/components/forms/input";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import { type FieldErrors, isApiError } from "@/lib/api/errors";
import { formatContactNumber } from "@/lib/auth/verification-review";
import { useToast } from "@/providers/toast-provider";
import { updateContactDetails } from "../api/settings";
import { CONTACT_LABELS, CONTACT_LIMITS, contactFieldsFor, contactProblems } from "../schemas/accounts";
import type { ContactDetails } from "../types/accounts";

type Props = {
  role: "pet" | "human";
  details: ContactDetails;
};

const UNKNOWN_PROBLEM = "That didn't save. Check your connection and try again.";
const isNumberField = (field: keyof ContactDetails) => field === "caretaker_contact_number" || field === "contact_number";

/** The role's contact details as the form shows them: numbers spaced the way people write them. */
function shown(role: Props["role"], details: ContactDetails): ContactDetails {
  return Object.fromEntries(contactFieldsFor(role).map((field) => [field, isNumberField(field) ? formatContactNumber(details[field] ?? "") : (details[field] ?? "")]));
}

// The contact details of Settings (AC-01 a pet's caretaker, AC-02 a human's own). They are private: the API sends
// them to their owner only, and to the other side on a confirmed Meet & Greet (SEC-PRIV-02). They live in this
// form's state and nowhere else: no browser storage, no URL (SEC-FE-04). Nothing typed is lost when a save fails.
export function ContactDetailsForm({ role, details }: Props) {
  const toast = useToast();
  const [saved, setSaved] = useState(() => shown(role, details));
  const [values, setValues] = useState(saved);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fields = contactFieldsFor(role);
  const changed = fields.some((field) => (values[field] ?? "").trim() !== (saved[field] ?? "").trim());

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !changed) return;
    const found = contactProblems(role, values);
    if (Object.keys(found).length) return setErrors(found);

    setBusy(true);
    setProblem(null);
    try {
      const settings = await updateContactDetails(api, Object.fromEntries(fields.map((field) => [field, (values[field] ?? "").trim()])));
      const next = shown(role, settings.contact_details);
      setSaved(next);
      setValues(next);
      toast.show("Contact details saved.");
    } catch (failure) {
      if (isApiError(failure) && failure.kind === "validation") setErrors(failure.fieldErrors);
      else setProblem(isApiError(failure) ? failure.message : UNKNOWN_PROBLEM);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
        {fields.map((field) => (
          <Field key={field} label={CONTACT_LABELS[field]} error={errors[field]} hint={isNumberField(field) ? "A mobile number, like 0917 123 4567." : undefined} required>
            <Input
              type={isNumberField(field) ? "tel" : "text"}
              name={field}
              autoComplete={isNumberField(field) ? "tel-national" : field === "street_address" ? "street-address" : "name"}
              value={values[field] ?? ""}
              onChange={(event) => {
                setValues((current) => ({ ...current, [field]: event.target.value }));
                setErrors({});
              }}
              maxLength={CONTACT_LIMITS[field]}
              disabled={busy}
            />
          </Field>
        ))}
      </div>
      {problem && (
        <Alert tone="error" announce>
          {problem}
        </Alert>
      )}
      <Button type="submit" variant="primary" size="sm" className="self-start" disabled={!changed} loading={busy} loadingLabel="Saving your contact details">
        Save contact details
      </Button>
    </form>
  );
}
