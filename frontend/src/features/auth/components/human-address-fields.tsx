"use client";

import { Field } from "@/components/forms/field";
import { Input } from "@/components/forms/input";
import { Select } from "@/components/forms/select";
import { PROVINCES } from "@/constants/provinces";
import type { FieldErrors } from "@/lib/api/errors";
import { SIGN_UP_TEXT_LIMITS as LIMITS } from "@/lib/auth/sign-up-rules";
import type { TextBinder } from "../hooks/use-form-fields";
import { FIELD_GRID } from "./field-grid";

type Props = {
  text: TextBinder<"city" | "province" | "street_address">;
  errors: FieldErrors;
};

// Where a human lives (AU-15), also edited on AU-19. Only the city is ever public (SEC-PRIV-03).
export function HumanAddressFields({ text, errors }: Props) {
  return (
    <div className={FIELD_GRID}>
      <Field label="City" error={errors.city}>
        <Input {...text("city")} autoComplete="address-level2" maxLength={LIMITS.city} placeholder="e.g. Quezon City" />
      </Field>
      <Field label="Province" error={errors.province} hint="Matches are limited to the same province.">
        <Select {...text("province")} autoComplete="address-level1" options={[...PROVINCES]} placeholder="Choose a province" />
      </Field>
      <Field
        label="Street address"
        error={errors.street_address}
        hint="Private. Only your city is shown publicly."
        className="md:col-span-2"
      >
        <Input {...text("street_address")} autoComplete="street-address" maxLength={LIMITS.street_address} />
      </Field>
    </div>
  );
}
