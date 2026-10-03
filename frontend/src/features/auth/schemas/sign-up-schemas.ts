import { PROVINCES } from "@/constants/provinces";
import type { FieldErrors } from "@/lib/api/errors";
import { firstPasswordProblem } from "@/lib/auth/password-rules";
import {
  SIGN_UP_REQUIRED_MESSAGES as REQUIRED,
  type SignUpRequiredField,
  approximateAgeProblem,
  birthdateProblem,
  contactNumberProblem,
  normalizeContactNumber,
} from "@/lib/auth/sign-up-rules";
import type { Species } from "@/types/pet";
import type { IdType } from "@/types/verification";
import { emailProblem } from "./auth-schemas";

// Client checks for the sign-up wizards (AU-08…AU-17), one step at a time, mirroring the sign-up Form Requests and
// their messages (docs/api/auth.md). Errors are keyed by the API's field names, so a 422 from the server lands on the
// same fields. They give quick feedback; the API decides (frontend-guidelines §8).

export type AgeUnit = "years" | "months";

type AccountValues = { email: string; password: string; password_confirmation: string };

/** What the pet wizard holds while it is open. Kept in memory only, never in browser storage (SEC-FE-04). */
export type PetSignUpValues = AccountValues & {
  name: string;
  species: Species | "";
  breed: string;
  /** Typed as a number and a unit; sent as `approximate_age_months`. */
  age_amount: string;
  age_unit: AgeUnit;
  currently_at: string;
  city: string;
  province: string;
  photos: File[];
  caretaker_name: string;
  caretaker_contact_number: string;
  valid_id: File | null;
  vet_record: File | null;
  terms_accepted: boolean;
};

export type HumanSignUpValues = AccountValues & {
  full_name: string;
  birthdate: string;
  contact_number: string;
  city: string;
  province: string;
  street_address: string;
  id_type: IdType | "";
  valid_id: File | null;
  terms_accepted: boolean;
};

const EMPTY_ACCOUNT: AccountValues = { email: "", password: "", password_confirmation: "" };

export const EMPTY_PET_SIGN_UP: PetSignUpValues = {
  ...EMPTY_ACCOUNT,
  name: "",
  species: "",
  breed: "",
  age_amount: "",
  age_unit: "years",
  currently_at: "",
  city: "",
  province: "",
  photos: [],
  caretaker_name: "",
  caretaker_contact_number: "",
  valid_id: null,
  vet_record: null,
  terms_accepted: false,
};

export const EMPTY_HUMAN_SIGN_UP: HumanSignUpValues = {
  ...EMPTY_ACCOUNT,
  full_name: "",
  birthdate: "",
  contact_number: "",
  city: "",
  province: "",
  street_address: "",
  id_type: "",
  valid_id: null,
  terms_accepted: false,
};

/** The API fields each wizard step collects, in step order. Used to send a 422's errors back to the right step. */
export type StepFields = readonly (readonly string[])[];

export const PET_STEP_FIELDS: StepFields = [
  ["email", "password", "password_confirmation"],
  ["name", "species", "breed", "approximate_age_months", "currently_at", "city", "province"],
  ["photos"],
  ["caretaker_name", "caretaker_contact_number", "valid_id", "vet_record"],
  ["terms_accepted"],
];

export const HUMAN_STEP_FIELDS: StepFields = [
  ["email", "password", "password_confirmation"],
  ["full_name", "birthdate", "contact_number"],
  ["city", "province", "street_address"],
  ["id_type", "valid_id"],
  ["terms_accepted"],
];

function requireText<V>(values: V, errors: FieldErrors, fields: (SignUpRequiredField & keyof V)[]): void {
  for (const field of fields) if (!String(values[field]).trim()) errors[field] = REQUIRED[field];
}

function accountErrors({ email, password, password_confirmation: confirmation }: AccountValues): FieldErrors {
  const errors: FieldErrors = {};
  const emailError = emailProblem(email);
  if (emailError) errors.email = emailError;
  if (!password) errors.password = REQUIRED.password;
  else {
    const problem = firstPasswordProblem(password);
    if (problem) errors.password = problem;
  }
  if (!confirmation) errors.password_confirmation = "Confirm your password.";
  else if (password && confirmation !== password) errors.password_confirmation = "The passwords don't match.";
  return errors;
}

function provinceError(province: string, errors: FieldErrors): void {
  if (!(PROVINCES as readonly string[]).includes(province)) errors.province = REQUIRED.province;
}

function termsErrors({ terms_accepted: accepted }: { terms_accepted: boolean }): FieldErrors {
  return accepted ? {} : { terms_accepted: REQUIRED.terms_accepted };
}

/** The pet's age in months from the number and unit typed, or null when the number is missing. */
export function approximateAgeMonths(amount: string, unit: AgeUnit): number | null {
  if (!amount.trim()) return null;
  const count = Number(amount);
  return unit === "years" ? count * 12 : count;
}

/** Problems on one step of the pet wizard (0 Account … 4 Review); empty when the step can be left. */
export function validatePetStep(step: number, values: PetSignUpValues): FieldErrors {
  if (step === 0) return accountErrors(values);
  if (step === 4) return termsErrors(values);
  const errors: FieldErrors = {};
  if (step === 1) {
    requireText(values, errors, ["name", "species", "breed", "currently_at", "city"]);
    provinceError(values.province, errors);
    const ageProblem = approximateAgeProblem(approximateAgeMonths(values.age_amount, values.age_unit));
    if (ageProblem) errors.approximate_age_months = ageProblem;
  }
  if (step === 2 && values.photos.length === 0) errors.photos = REQUIRED.photos;
  if (step === 3) {
    requireText(values, errors, ["caretaker_name"]);
    const contactProblem = contactNumberProblem(values.caretaker_contact_number);
    if (contactProblem) errors.caretaker_contact_number = contactProblem;
    if (!values.valid_id) errors.valid_id = REQUIRED.valid_id;
  }
  return errors;
}

/** Problems on one step of the human wizard. `today` decides the 18-or-older check (SEC-INPUT-05). */
export function validateHumanStep(step: number, values: HumanSignUpValues, today: Date = new Date()): FieldErrors {
  if (step === 0) return accountErrors(values);
  if (step === 4) return termsErrors(values);
  const errors: FieldErrors = {};
  if (step === 1) {
    requireText(values, errors, ["full_name"]);
    const birthProblem = birthdateProblem(values.birthdate, today);
    if (birthProblem) errors.birthdate = birthProblem;
    const contactProblem = contactNumberProblem(values.contact_number);
    if (contactProblem) errors.contact_number = contactProblem;
  }
  if (step === 2) {
    requireText(values, errors, ["city", "street_address"]);
    provinceError(values.province, errors);
  }
  if (step === 3) {
    requireText(values, errors, ["id_type"]);
    if (!values.valid_id) errors.valid_id = REQUIRED.valid_id;
  }
  return errors;
}

/**
 * Sorts a 422's errors by the field the wizard shows them on ("photos.0" → "photos") and finds the first step that
 * has one. `unplaced` holds messages for fields no step shows, so they can still be read out.
 */
export function placeFieldErrors(
  stepFields: StepFields,
  fieldErrors: FieldErrors,
): { errors: FieldErrors; firstStep: number | null; unplaced: string[] } {
  const errors: FieldErrors = {};
  const unplaced: string[] = [];
  let firstStep: number | null = null;
  for (const [key, message] of Object.entries(fieldErrors)) {
    const field = key.split(".")[0];
    const step = stepFields.findIndex((fields) => fields.includes(field));
    if (step === -1) {
      unplaced.push(message);
      continue;
    }
    errors[field] ??= message;
    if (firstStep === null || step < firstStep) firstStep = step;
  }
  return { errors, firstStep, unplaced };
}

function baseForm({ email, password, password_confirmation: confirmation }: AccountValues): FormData {
  const form = new FormData();
  form.set("email", email.trim().toLowerCase());
  form.set("password", password);
  form.set("password_confirmation", confirmation);
  form.set("terms_accepted", "1");
  return form;
}

/**
 * The multipart body for `POST /auth/sign-up/pet`, trimmed and normalized (SEC-INPUT-06). Call it only with values
 * that passed every step, with the Terms checkbox ticked.
 */
export function toPetSignUpForm(values: PetSignUpValues): FormData {
  const form = baseForm(values);
  form.set("name", values.name.trim());
  form.set("species", values.species);
  form.set("breed", values.breed.trim());
  form.set("approximate_age_months", String(approximateAgeMonths(values.age_amount, values.age_unit) ?? ""));
  form.set("currently_at", values.currently_at.trim());
  form.set("city", values.city.trim());
  form.set("province", values.province);
  for (const photo of values.photos) form.append("photos[]", photo);
  form.set("caretaker_name", values.caretaker_name.trim());
  form.set("caretaker_contact_number", normalizeContactNumber(values.caretaker_contact_number) ?? "");
  if (values.valid_id) form.set("valid_id", values.valid_id);
  if (values.vet_record) form.set("vet_record", values.vet_record);
  return form;
}

/** The multipart body for `POST /auth/sign-up/human`. */
export function toHumanSignUpForm(values: HumanSignUpValues): FormData {
  const form = baseForm(values);
  form.set("full_name", values.full_name.trim());
  form.set("birthdate", values.birthdate);
  form.set("contact_number", normalizeContactNumber(values.contact_number) ?? "");
  form.set("city", values.city.trim());
  form.set("province", values.province);
  form.set("street_address", values.street_address.trim());
  form.set("id_type", values.id_type);
  if (values.valid_id) form.set("valid_id", values.valid_id);
  return form;
}

/** "2 years", "1 year", "8 months" for the review step; empty until a number is typed. */
export function formatApproximateAge(amount: string, unit: AgeUnit): string {
  const count = Number(amount);
  if (!amount.trim() || !Number.isFinite(count)) return "";
  return `${count} ${count === 1 ? unit.slice(0, -1) : unit}`;
}

/** "Mar 4, 1990" for the review step, from the date input's "1990-03-04"; empty when it isn't a date yet. */
export function formatBirthdate(birthdate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthdate);
  if (!match) return "";
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
