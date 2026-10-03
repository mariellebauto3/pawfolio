"use client";

import { Field } from "@/components/forms/field";
import { Fieldset } from "@/components/forms/fieldset";
import { FileUpload } from "@/components/forms/file-upload";
import { Input } from "@/components/forms/input";
import { Select } from "@/components/forms/select";
import { Wizard } from "@/components/forms/wizard";
import { Icon } from "@/components/ui/icon";
import { SPECIES_LABELS } from "@/constants/pets";
import { PROVINCES } from "@/constants/provinces";
import { api } from "@/lib/api/client";
import { MAX_SIGN_UP_PET_PHOTOS, SIGN_UP_TEXT_LIMITS as LIMITS } from "@/lib/auth/sign-up-rules";
import { SPECIES } from "@/types/pet";
import { signUpPet } from "../api/sign-up";
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

const SPECIES_OPTIONS = SPECIES.map((value) => ({ value, label: SPECIES_LABELS[value] }));
const AGE_UNITS = ["years", "months"];
const GRID = "grid gap-5 md:grid-cols-2";

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
              <>
                <div className={GRID}>
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
                        onChange={(event) =>
                          set("age_amount", event.target.value.replace(/\D/g, "").slice(0, 3), "approximate_age_months")
                        }
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
                    <Input
                      {...text("currently_at")}
                      autoComplete="off"
                      maxLength={LIMITS.currently_at}
                      placeholder="e.g. Happy Paws Rescue foster"
                    />
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
                <div className={GRID}>
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
