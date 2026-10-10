"use client";

import { type FormEvent, useState } from "react";
import { Alert } from "@/components/feedback/alert";
import { Field } from "@/components/forms/field";
import { FileUpload } from "@/components/forms/file-upload";
import { Input } from "@/components/forms/input";
import { Select } from "@/components/forms/select";
import { Textarea } from "@/components/forms/textarea";
import { Modal } from "@/components/overlays/modal";
import { Button } from "@/components/ui/button";
import { SPECIES_LABELS, optionsFrom } from "@/constants/pets";
import { PROVINCES } from "@/constants/provinces";
import { api } from "@/lib/api/client";
import { type FieldErrors, isApiError } from "@/lib/api/errors";
import { SIGN_UP_TEXT_LIMITS } from "@/lib/auth/sign-up-rules";
import { philippineToday } from "@/lib/utils/format-date";
import { requestChange } from "../api/settings";
import { CHANGE_REASON_MAX, LOCKED_FIELD_LABELS, ageInMonths, changeRequestProblems, formatLockedValue } from "../schemas/accounts";
import type { LockedField, Settings } from "../types/accounts";

type Props = {
  open: boolean;
  onClose: () => void;
  role: "pet" | "human";
  /** The details that can be asked for: the role's locked ones without a request already waiting. */
  fields: LockedField[];
  /** The detail the dialog opens on, from a field's own "Request a change". */
  initialField?: LockedField;
  /** What the account says today, to show beside the new value and to refuse a change to the same thing. */
  details: Settings["locked_details"];
  /** The request is sent and the dialog has closed. The caller confirms with a toast. */
  onSent: () => void;
  /** A request for that detail was already waiting (409). The dialog has closed. */
  onAlreadyWaiting: (message: string) => void;
};

const UNKNOWN_PROBLEM = "That didn't go through. Check your connection and try again.";
const TEXT_LIMITS: Partial<Record<LockedField, number>> = {
  name: SIGN_UP_TEXT_LIMITS.name,
  breed: SIGN_UP_TEXT_LIMITS.breed,
  full_name: SIGN_UP_TEXT_LIMITS.full_name,
  city: SIGN_UP_TEXT_LIMITS.city,
};

export function RequestChangeDialog(props: Props) {
  // Mounted only while open, so the form starts over every time.
  return props.open ? <RequestChangeForm {...props} /> : null;
}

// AC-03 Request a change: which verified detail, its new value, why, and a document that supports it. Nothing
// changes until an admin approves it. The new value's control follows the detail (a list for species and province,
// a date for a birthdate, a number of months or years for an age), and the API holds it to the same rule as the
// sign-up field it would replace.
function RequestChangeForm({ onClose, role, fields, initialField, details, onSent, onAlreadyWaiting }: Props) {
  const [field, setField] = useState<LockedField | null>(initialField ?? (fields.length === 1 ? fields[0] : null));
  const [value, setValue] = useState("");
  const [ageUnit, setAgeUnit] = useState<"months" | "years">("years");
  const [reason, setReason] = useState("");
  const [document, setDocument] = useState<File | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // An age is typed as a number with its unit and sent in months, as the API holds it.
  const newValue = field === "approximate_age_months" ? String(ageInMonths(value, ageUnit) ?? value.trim()) : value.trim();
  const current = field ? details[field] : undefined;

  function chooseField(next: string) {
    setField(fields.find((candidate) => candidate === next) ?? null);
    setValue("");
    setErrors({});
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const found = changeRequestProblems({ field, new_value: newValue, reason }, current, new Date(`${philippineToday()}T00:00:00`));
    if (Object.keys(found).length || field === null) return setErrors(found);

    setBusy(true);
    setProblem(null);
    try {
      await requestChange(api, { field, new_value: newValue, reason: reason.trim(), document });
      onClose();
      onSent();
    } catch (failure) {
      setBusy(false);
      if (!isApiError(failure)) return setProblem(UNKNOWN_PROBLEM);
      if (failure.kind === "validation") return setErrors(failure.fieldErrors);
      if (failure.kind === "conflict") {
        onClose();
        return onAlreadyWaiting(failure.message);
      }
      setProblem(failure.message);
    }
  }

  const change = (next: string) => {
    setValue(next);
    setErrors({});
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Request a change to verified details"
      subtitle="An admin reviews the change before it’s applied."
      dismissible={!busy}
      closeOnBackdrop={false}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={busy} loadingLabel="Sending your request">
            Send request
          </Button>
        </>
      }
    >
      <Field label="Detail to change" error={errors.field} hint={current !== undefined && field ? `Now: ${formatLockedValue(field, current)}` : undefined} required>
        <Select
          name="field"
          value={field ?? ""}
          onChange={(event) => chooseField(event.target.value)}
          options={fields.map((candidate) => ({ value: candidate, label: LOCKED_FIELD_LABELS[candidate] }))}
          placeholder="Choose a detail"
          disabled={busy}
        />
      </Field>

      {field === "species" ? (
        <Field label="New species" error={errors.new_value} required>
          <Select name="new_value" value={value} onChange={(event) => change(event.target.value)} options={optionsFrom(SPECIES_LABELS)} placeholder="Choose a species" disabled={busy} />
        </Field>
      ) : field === "province" ? (
        <Field label="New province" error={errors.new_value} required>
          <Select name="new_value" value={value} onChange={(event) => change(event.target.value)} options={[...PROVINCES]} placeholder="Choose a province" disabled={busy} />
        </Field>
      ) : field === "birthdate" ? (
        <Field label="New birthdate" error={errors.new_value} hint="As it is written on your ID." required>
          <Input type="date" name="new_value" value={value} onChange={(event) => change(event.target.value)} max={philippineToday()} disabled={busy} />
        </Field>
      ) : field === "approximate_age_months" ? (
        <Field label="New approximate age" error={errors.new_value} hint="Use months for a pet under a year old." required>
          <div className="flex gap-3">
            <Input type="text" inputMode="numeric" name="new_value" value={value} onChange={(event) => change(event.target.value)} maxLength={3} className="w-24" disabled={busy} />
            <Select
              aria-label="Unit"
              name="age_unit"
              value={ageUnit}
              onChange={(event) => {
                setAgeUnit(event.target.value === "months" ? "months" : "years");
                setErrors({});
              }}
              options={[
                { value: "years", label: "years" },
                { value: "months", label: "months" },
              ]}
              disabled={busy}
            />
          </div>
        </Field>
      ) : (
        <Field label={field ? `New ${LOCKED_FIELD_LABELS[field].toLowerCase()}` : "New value"} error={errors.new_value} hint={role === "human" && field === "full_name" ? "As it is written on your ID." : undefined} required>
          <Input type="text" name="new_value" value={value} onChange={(event) => change(event.target.value)} maxLength={field ? TEXT_LIMITS[field] : 255} disabled={busy || field === null} />
        </Field>
      )}

      <Field label="Reason" error={errors.reason} hint="Say why it should change, so an admin can check it." required>
        <Textarea
          name="reason"
          rows={3}
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
            setErrors({});
          }}
          placeholder={role === "pet" ? "e.g. The vet confirmed a different breed." : "e.g. I got married and my ID has my new name."}
          maxLength={CHANGE_REASON_MAX}
          disabled={busy}
        />
      </Field>

      <FileUpload
        label="Supporting document"
        hint="A vet record or an ID that shows the new detail. JPG, PNG or PDF, up to 5 MB. Only admins see it."
        error={errors.document}
        optional
        onFilesChange={(files) => {
          setDocument(files[0] ?? null);
          setErrors({});
        }}
      />

      {problem && (
        <Alert tone="error" announce>
          {problem}
        </Alert>
      )}
    </Modal>
  );
}
