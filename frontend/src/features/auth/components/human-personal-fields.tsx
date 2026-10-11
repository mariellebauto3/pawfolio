"use client";

import { Field } from "@/components/forms/field";
import { Input } from "@/components/forms/input";
import type { FieldErrors } from "@/lib/api/errors";
import { SIGN_UP_TEXT_LIMITS as LIMITS } from "@/lib/auth/sign-up-rules";
import type { TextBinder } from "../hooks/use-form-fields";
import { FIELD_GRID } from "./field-grid";

type Props = {
  text: TextBinder<"full_name" | "birthdate" | "contact_number">;
  errors: FieldErrors;
};

// A human's identity details (AU-14), also edited on AU-19: what an admin checks against the ID.
export function HumanPersonalFields({ text, errors }: Props) {
  return (
    <div className={FIELD_GRID}>
      <Field label="Full name" error={errors.full_name} hint="As shown on your ID." className="md:col-span-2">
        <Input {...text("full_name")} autoComplete="name" maxLength={LIMITS.full_name} />
      </Field>
      <Field label="Birthdate" error={errors.birthdate} hint={errors.birthdate ? undefined : "You must be 18 or older."}>
        <Input {...text("birthdate")} type="date" autoComplete="bday" />
      </Field>
      <Field label="Contact number" error={errors.contact_number} hint="Shared only after a Meet & Greet is confirmed.">
        <Input {...text("contact_number")} type="tel" autoComplete="tel" placeholder="09XX XXX XXXX" />
      </Field>
    </div>
  );
}
