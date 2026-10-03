"use client";

import { FileUpload } from "@/components/forms/file-upload";
import { Wizard } from "@/components/forms/wizard";
import { SPECIES_LABELS } from "@/constants/pets";
import { api } from "@/lib/api/client";
import { MAX_SIGN_UP_PET_PHOTOS } from "@/lib/auth/sign-up-rules";
import { signUpPet } from "../api/sign-up";
import { CaretakerFields } from "../components/caretaker-fields";
import { FIELD_GRID } from "../components/field-grid";
import { PetDetailFields } from "../components/pet-detail-fields";
import { SignUpAccountFields } from "../components/sign-up-account-fields";
import { SignUpFrame } from "../components/sign-up-frame";
import { SignUpReview } from "../components/sign-up-review";
import { useSignUpWizard } from "../hooks/use-sign-up-wizard";
import {
  EMPTY_PET_SIGN_UP,
  PET_STEP_FIELDS,
  type PetSignUpValues,
  formatApproximateAge,
  toPetSignUpForm,
  validatePetStep,
} from "../schemas/sign-up-schemas";

const submit = (values: PetSignUpValues) => signUpPet(api, toPetSignUpForm(values));
const joined = (parts: string[]) => parts.filter(Boolean).join(" · ");
const place = (city: string, province: string) => [city.trim(), province].filter(Boolean).join(", ");

// AU-08…AU-12: a caretaker signs a pet up in five steps (FR18, NFR1). On success the account is Pending Verification
// and lands on the account-status screen (AU-18).
export function PetSignUpWizard() {
  const { values, errors, problem, set, text, goToStep, wizardProps } = useSignUpWizard({
    initial: EMPTY_PET_SIGN_UP,
    stepFields: PET_STEP_FIELDS,
    validateStep: validatePetStep,
    submit,
  });
  const photoCount = values.photos.length;

  return (
    <SignUpFrame title="Sign up a pet" problem={problem}>
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
                emailPlaceholder="caretaker@email.com"
                emailHint="Used to sign in to the pet's account."
              />
            ),
          },
          {
            label: "Pet details",
            content: (
              <PetDetailFields
                text={text}
                onAgeAmountChange={(digits) => set("age_amount", digits, "approximate_age_months")}
                errors={errors}
              />
            ),
          },
          {
            label: "Photo",
            content: (
              <FileUpload
                label="Photos of the pet"
                accept={["jpg", "png"]}
                multiple
                maxFiles={MAX_SIGN_UP_PET_PHOTOS}
                hint={`At least one clear photo. JPG or PNG, up to 5 MB each, up to ${MAX_SIGN_UP_PET_PHOTOS} photos.`}
                error={errors.photos}
                onFilesChange={(files) => set("photos", files)}
              />
            ),
          },
          {
            label: "Caretaker & ID",
            content: (
              <>
                <p className="max-w-[65ch] text-ink-muted">
                  The caretaker is the person our admins verify: a foster, finder or shelter volunteer looking after the pet.
                </p>
                <CaretakerFields text={text} errors={errors} />
                <div className={FIELD_GRID}>
                  <FileUpload
                    label="Caretaker's valid ID"
                    hint="JPG, PNG or PDF, up to 5 MB. Visible to admins only."
                    error={errors.valid_id}
                    onFilesChange={(files) => set("valid_id", files[0] ?? null)}
                  />
                  <FileUpload
                    label="Vet record or shelter certificate"
                    optional
                    hint="Speeds up the review. JPG, PNG or PDF, up to 5 MB. Visible to admins only."
                    error={errors.vet_record}
                    onFilesChange={(files) => set("vet_record", files[0] ?? null)}
                  />
                </div>
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
                    title: "Pet details",
                    step: 1,
                    rows: [
                      {
                        label: "Pet",
                        value: joined([
                          values.name.trim(),
                          values.species && SPECIES_LABELS[values.species],
                          values.breed.trim(),
                          formatApproximateAge(values.age_amount, values.age_unit),
                        ]),
                      },
                      { label: "Staying at", value: joined([values.currently_at.trim(), place(values.city, values.province)]) },
                    ],
                  },
                  {
                    title: "Photos",
                    step: 2,
                    rows: [{ label: "Added", value: `${photoCount} ${photoCount === 1 ? "photo" : "photos"}` }],
                  },
                  {
                    title: "Caretaker & ID",
                    step: 3,
                    rows: [
                      { label: "Caretaker", value: joined([values.caretaker_name.trim(), values.caretaker_contact_number.trim()]) },
                      { label: "Valid ID", value: values.valid_id?.name },
                      { label: "Vet record", value: values.vet_record?.name ?? "Not added" },
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
