import type { FieldErrors } from "@/lib/api/errors";
import { SIGN_UP_REQUIRED_MESSAGES as REQUIRED } from "@/lib/auth/sign-up-rules";
import type { HumanSubmission, PetSubmission } from "@/types/account-status";
import {
  type AgeUnit,
  type HumanDetailValues,
  type PetDetailValues,
  appendHumanDetails,
  appendPetDetails,
  caretakerErrors,
  humanAddressErrors,
  humanPersonalErrors,
  petDetailErrors,
} from "./sign-up-schemas";

// Client checks for "Edit submitted details" (AU-19), mirroring `PATCH /account/submission` (docs/api/auth.md). The
// details and their rules are the sign-up ones; the difference is the files, which are optional here: leaving one
// out keeps the file already sent. They give quick feedback; the API decides (frontend-guidelines §8).

/** The API fields each form shows, to place a 422's errors ("photos.0" → "photos"). */
export const PET_SUBMISSION_FIELDS = [
  "name",
  "species",
  "breed",
  "approximate_age_months",
  "currently_at",
  "city",
  "province",
  "caretaker_name",
  "caretaker_contact_number",
  "photos",
  "valid_id",
  "vet_record",
] as const;

export const HUMAN_SUBMISSION_FIELDS = [
  "full_name",
  "birthdate",
  "contact_number",
  "city",
  "province",
  "street_address",
  "id_type",
  "valid_id",
] as const;

/** An age in months as the form's number and unit: whole years when it divides evenly, otherwise months. */
export function splitApproximateAge(months: number): { age_amount: string; age_unit: AgeUnit } {
  return months >= 12 && months % 12 === 0
    ? { age_amount: String(months / 12), age_unit: "years" }
    : { age_amount: String(months), age_unit: "months" };
}

/** The edit form filled with what the pet's caretaker submitted. No file is chosen yet. */
export function petSubmissionValues(submission: PetSubmission): PetDetailValues {
  return {
    name: submission.name,
    species: submission.species,
    breed: submission.breed,
    ...splitApproximateAge(submission.approximate_age_months),
    currently_at: submission.currently_at,
    city: submission.city,
    province: submission.province,
    photos: [],
    caretaker_name: submission.caretaker_name,
    caretaker_contact_number: submission.caretaker_contact_number,
    valid_id: null,
    vet_record: null,
  };
}

/** The edit form filled with what the human submitted. The ID type comes from the ID already sent. */
export function humanSubmissionValues(submission: HumanSubmission): HumanDetailValues {
  return {
    full_name: submission.full_name,
    birthdate: submission.birthdate,
    contact_number: submission.contact_number,
    city: submission.city,
    province: submission.province,
    street_address: submission.street_address,
    id_type: submission.documents.find((document) => document.document_type === "valid_id")?.id_type ?? "",
    valid_id: null,
  };
}

export function validatePetSubmission(values: PetDetailValues): FieldErrors {
  return { ...petDetailErrors(values), ...caretakerErrors(values) };
}

/** `today` decides the 18-or-older check (SEC-INPUT-05). */
export function validateHumanSubmission(values: HumanDetailValues, today: Date = new Date()): FieldErrors {
  const errors = { ...humanPersonalErrors(values, today), ...humanAddressErrors(values) };
  if (!values.id_type) errors.id_type = REQUIRED.id_type;
  return errors;
}

/** The multipart body for `PATCH /account/submission` from a pet account. Call it with values that passed the check. */
export function toPetSubmissionForm(values: PetDetailValues): FormData {
  const form = new FormData();
  appendPetDetails(form, values);
  return form;
}

/** The multipart body for `PATCH /account/submission` from a human account. */
export function toHumanSubmissionForm(values: HumanDetailValues): FormData {
  const form = new FormData();
  appendHumanDetails(form, values);
  return form;
}
