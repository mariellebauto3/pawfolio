"use client";

import { Field } from "@/components/forms/field";
import { FileUpload } from "@/components/forms/file-upload";
import { Input } from "@/components/forms/input";
import { Select } from "@/components/forms/select";
import { Wizard } from "@/components/forms/wizard";
import { PROVINCES } from "@/constants/provinces";
import { ID_TYPE_LABELS } from "@/constants/verification";
import { api } from "@/lib/api/client";
import { SIGN_UP_TEXT_LIMITS as LIMITS, ageOn } from "@/lib/auth/sign-up-rules";
import { ID_TYPES } from "@/types/verification";
import { signUpHuman } from "../api/sign-up";
import { SignUpAccountFields } from "../components/sign-up-account-fields";
import { SignUpFrame } from "../components/sign-up-frame";
import { SignUpReview } from "../components/sign-up-review";
import { useSignUpWizard } from "../hooks/use-sign-up-wizard";
import {
  EMPTY_HUMAN_SIGN_UP,
  HUMAN_STEP_FIELDS,
  type HumanSignUpValues,
  formatBirthdate,
  toHumanSignUpForm,
  validateHumanStep,
} from "../schemas/sign-up-schemas";

const ID_TYPE_OPTIONS = ID_TYPES.map((value) => ({ value, label: ID_TYPE_LABELS[value] }));
const GRID = "grid gap-5 md:grid-cols-2";

const validateStep = (step: number, values: HumanSignUpValues) => validateHumanStep(step, values);
const submit = (values: HumanSignUpValues) => signUpHuman(api, toHumanSignUpForm(values));

function birthdateWithAge(birthdate: string): string {
  const age = ageOn(birthdate, new Date());
  const date = formatBirthdate(birthdate);
  return date && age !== null ? `${date} (${age})` : date;
}

// AU-13…AU-17: an adopter signs up in five steps (FR1, NFR1). On success the account is Pending Verification and
// lands on the account-status screen (AU-18).
export function HumanSignUpWizard() {
  const { values, errors, problem, set, text, goToStep, wizardProps } = useSignUpWizard({
    initial: EMPTY_HUMAN_SIGN_UP,
    stepFields: HUMAN_STEP_FIELDS,
    validateStep,
    submit,
  });

  return (
    <SignUpFrame title="Sign up to adopt" problem={problem}>
      <Wizard
        {...wizardProps}
        finishLabel="Submit for verification"
        steps={[
          {
            label: "Account",
            content: (
              <SignUpAccountFields
                email={text("email")}
                password={text("password")}
                confirmation={text("password_confirmation")}
                errors={errors}
                emailPlaceholder="you@email.com"
              />
            ),
          },
          {
            label: "Personal details",
            content: (
              <div className={GRID}>
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
            ),
          },
          {
            label: "Address",
            content: (
              <div className={GRID}>
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
            ),
          },
          {
            label: "Valid ID",
            content: (
              <>
                <Field label="ID type" error={errors.id_type}>
                  <Select {...text("id_type")} options={ID_TYPE_OPTIONS} placeholder="Choose the type of ID" />
                </Field>
                <FileUpload
                  label="Photo of your valid ID"
                  hint="JPG, PNG or PDF, up to 5 MB. Visible to admins only."
                  error={errors.valid_id}
                  onFilesChange={(files) => set("valid_id", files[0] ?? null)}
                />
              </>
            ),
          },
          {
            label: "Review",
            content: (
              <SignUpReview
                onEdit={goToStep}
                termsAccepted={values.terms_accepted}
                onTermsChange={(accepted) => set("terms_accepted", accepted)}
                termsError={errors.terms_accepted}
                sections={[
                  { title: "Account", step: 0, rows: [{ label: "Email", value: values.email.trim() }] },
                  {
                    title: "Personal details",
                    step: 1,
                    rows: [
                      { label: "Name", value: values.full_name.trim() },
                      { label: "Birthdate", value: birthdateWithAge(values.birthdate) },
                      { label: "Contact number", value: values.contact_number.trim() },
                    ],
                  },
                  {
                    title: "Address",
                    step: 2,
                    rows: [
                      { label: "City", value: [values.city.trim(), values.province].filter(Boolean).join(", ") },
                      { label: "Street address", value: values.street_address.trim() },
                    ],
                  },
                  {
                    title: "Valid ID",
                    step: 3,
                    rows: [
                      { label: "ID type", value: values.id_type && ID_TYPE_LABELS[values.id_type] },
                      { label: "ID photo", value: values.valid_id?.name },
                    ],
                  },
                ]}
              />
            ),
          },
        ]}
      />
    </SignUpFrame>
  );
}
