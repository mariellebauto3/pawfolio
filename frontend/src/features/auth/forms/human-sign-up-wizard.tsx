"use client";

import { FileUpload } from "@/components/forms/file-upload";
import { Wizard } from "@/components/forms/wizard";
import { ID_TYPE_LABELS } from "@/constants/verification";
import { api } from "@/lib/api/client";
import { ageOn } from "@/lib/auth/sign-up-rules";
import { signUpHuman } from "../api/sign-up";
import { HumanAddressFields } from "../components/human-address-fields";
import { HumanPersonalFields } from "../components/human-personal-fields";
import { IdTypeField } from "../components/id-type-field";
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
          { label: "Personal details", content: <HumanPersonalFields text={text} errors={errors} /> },
          { label: "Address", content: <HumanAddressFields text={text} errors={errors} /> },
          {
            label: "Valid ID",
            content: (
              <>
                <IdTypeField text={text} errors={errors} />
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
