"use client";

import { Field } from "@/components/forms/field";
import { Input } from "@/components/forms/input";
import type { FieldErrors } from "@/lib/api/errors";
import { SIGN_UP_TEXT_LIMITS as LIMITS } from "@/lib/auth/sign-up-rules";
import type { TextBinder } from "../hooks/use-form-fields";
import { FIELD_GRID } from "./field-grid";

type Props = {
  text: TextBinder<"caretaker_name" | "caretaker_contact_number">;
  errors: FieldErrors;
};

// The person our admins verify for a pet account (AU-11), also edited on AU-19.
export function CaretakerFields({ text, errors }: Props) {
  return (
    <div className={FIELD_GRID}>
      <Field label="Caretaker full name" error={errors.caretaker_name} hint="As shown on the ID.">
        <Input {...text("caretaker_name")} autoComplete="name" maxLength={LIMITS.caretaker_name} />
      </Field>
      <Field
        label="Caretaker contact number"
        error={errors.caretaker_contact_number}
        hint="Shared only after a Meet & Greet is confirmed."
      >
        <Input {...text("caretaker_contact_number")} type="tel" autoComplete="tel" placeholder="09XX XXX XXXX" />
      </Field>
    </div>
  );
}
