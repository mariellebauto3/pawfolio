"use client";

import { Field } from "@/components/forms/field";
import { Fieldset } from "@/components/forms/fieldset";
import { Input } from "@/components/forms/input";
import { Select } from "@/components/forms/select";
import { Icon } from "@/components/ui/icon";
import { SPECIES_LABELS } from "@/constants/pets";
import { PROVINCES } from "@/constants/provinces";
import type { FieldErrors } from "@/lib/api/errors";
import { SIGN_UP_TEXT_LIMITS as LIMITS } from "@/lib/auth/sign-up-rules";
import { SPECIES } from "@/types/pet";
import type { TextBinder } from "../hooks/use-form-fields";
import { FIELD_GRID } from "./field-grid";

const SPECIES_OPTIONS = SPECIES.map((value) => ({ value, label: SPECIES_LABELS[value] }));
const AGE_UNITS = ["years", "months"];

type Props = {
  text: TextBinder<"name" | "species" | "breed" | "age_amount" | "age_unit" | "currently_at" | "city" | "province">;
  /** Stores the age's number: digits only, three at most. */
  onAgeAmountChange: (digits: string) => void;
  errors: FieldErrors;
};

// The pet's own details (AU-09), also edited on AU-19: the facts an admin checks.
export function PetDetailFields({ text, onAgeAmountChange, errors }: Props) {
  return (
    <>
      <div className={FIELD_GRID}>
        <Field label="Pet name" error={errors.name}>
          <Input {...text("name")} autoComplete="off" maxLength={LIMITS.name} placeholder="e.g. Mochi" />
        </Field>
        <Field label="Species" error={errors.species}>
          <Select {...text("species")} options={SPECIES_OPTIONS} placeholder="Choose a species" />
        </Field>
        <Field label="Breed" error={errors.breed}>
          <Input {...text("breed")} autoComplete="off" maxLength={LIMITS.breed} placeholder="e.g. Aspin" />
        </Field>
        <Fieldset legend="Approximate age" error={errors.approximate_age_months}>
          <div className="flex gap-2">
            <Input
              {...text("age_amount", "approximate_age_months")}
              onChange={(event) => onAgeAmountChange(event.target.value.replace(/\D/g, "").slice(0, 3))}
              id="pet-age-amount"
              aria-label="Approximate age, number"
              inputMode="numeric"
              autoComplete="off"
              placeholder="e.g. 2"
              className="min-w-0 flex-1"
            />
            <Select
              {...text("age_unit", "approximate_age_months")}
              id="pet-age-unit"
              aria-label="Years or months"
              options={AGE_UNITS}
              className="w-32 shrink-0"
            />
          </div>
        </Fieldset>
        <Field label="Where the pet is staying" error={errors.currently_at} className="md:col-span-2">
          <Input {...text("currently_at")} autoComplete="off" maxLength={LIMITS.currently_at} placeholder="e.g. Happy Paws Rescue foster" />
        </Field>
        <Field label="City" error={errors.city}>
          <Input {...text("city")} autoComplete="address-level2" maxLength={LIMITS.city} placeholder="e.g. Quezon City" />
        </Field>
        <Field label="Province" error={errors.province} hint="Matches are limited to the same province.">
          <Select {...text("province")} autoComplete="address-level1" options={[...PROVINCES]} placeholder="Choose a province" />
        </Field>
      </div>
      <p className="flex items-start gap-2 text-sm text-ink-muted">
        <Icon name="lock" className="mt-0.5 size-4 shrink-0" />
        An admin checks the name, species, breed and age. They are locked once the account is approved.
      </p>
    </>
  );
}
