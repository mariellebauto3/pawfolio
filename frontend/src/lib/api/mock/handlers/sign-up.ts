import { PROVINCES } from "@/constants/provinces";
import { isEmail } from "@/lib/api/mock/handlers/auth";
import { type MockPersonaId, findMockPersonaByEmail, resolveMockAccount } from "@/lib/api/mock/personas";
import { type MockContext, type MockResult, type MockRoute, fail, ok, route, validationFailed } from "@/lib/api/mock/router";
import { AUTH_ENDPOINTS } from "@/lib/auth/endpoints";
import { firstPasswordProblem } from "@/lib/auth/password-rules";
import {
  MAX_SIGN_UP_PET_PHOTOS,
  MAX_UPLOAD_MB,
  SIGN_UP_REQUIRED_MESSAGES as REQUIRED,
  type SignUpRequiredField,
  approximateAgeProblem,
  birthdateProblem,
  contactNumberProblem,
} from "@/lib/auth/sign-up-rules";
import { SPECIES } from "@/types/pet";
import { ID_TYPES } from "@/types/verification";

// Mirrors the sign-up endpoints in docs/api/auth.md (BE-04, AU-08…AU-17). Try it in mock mode as the "signed-out"
// persona: a valid pet sign-up signs you in as the pending pet (Kulit), a human one as the pending human (Bea
// Navarro), whatever was typed; nothing is stored. Any persona's email, e.g. mochi@example.com, is "already taken".

type Errors = Record<string, string>;

export const EMAIL_TAKEN = "An account with this email already exists. Sign in, or use a different email.";
const SIGNED_IN = "You're already signed in. Log out to create another account.";

const PHOTO_TYPES = ["image/jpeg", "image/png"];
const DOCUMENT_TYPES = [...PHOTO_TYPES, "application/pdf"];
const WRONG_TYPE = { photo: "Upload a JPG or PNG photo.", document: "Upload a JPG, PNG or PDF file." };
const TOO_LARGE = `Each file must be ${MAX_UPLOAD_MB} MB or smaller.`;

const text = (form: FormData, field: string): string => {
  const value = form.get(field);
  return typeof value === "string" ? value.trim() : "";
};

const files = (form: FormData, field: string): File[] =>
  form.getAll(field).filter((value): value is File => typeof value !== "string" && value.size > 0);

function requireText(form: FormData, errors: Errors, fields: SignUpRequiredField[]): void {
  for (const field of fields) if (!text(form, field)) errors[field] = REQUIRED[field];
}

function requireOneOf(form: FormData, errors: Errors, field: SignUpRequiredField, allowed: readonly string[]): void {
  if (!allowed.includes(text(form, field))) errors[field] = REQUIRED[field];
}

function checkAccount(form: FormData, errors: Errors): void {
  const email = text(form, "email");
  if (!email) errors.email = REQUIRED.email;
  else if (!isEmail(email)) errors.email = "Enter a valid email address.";
  else if (findMockPersonaByEmail(email)) errors.email = EMAIL_TAKEN;

  const password = form.get("password");
  if (typeof password !== "string" || !password) errors.password = REQUIRED.password;
  else {
    const problem = firstPasswordProblem(password) ?? (password === form.get("password_confirmation") ? null : "The passwords don't match.");
    if (problem) errors.password = problem;
  }
}

function fileProblem(file: File, kind: keyof typeof WRONG_TYPE): string | null {
  if (!(kind === "photo" ? PHOTO_TYPES : DOCUMENT_TYPES).includes(file.type)) return WRONG_TYPE[kind];
  return file.size > MAX_UPLOAD_MB * 1024 * 1024 ? TOO_LARGE : null;
}

function checkDocument(form: FormData, errors: Errors, field: "valid_id" | "vet_record", required: boolean): void {
  const [file] = files(form, field);
  if (!file) {
    if (required) errors[field] = REQUIRED.valid_id;
    return;
  }
  const problem = fileProblem(file, "document");
  if (problem) errors[field] = problem;
}

function checkTerms(form: FormData, errors: Errors): void {
  if (form.get("terms_accepted") !== "1") errors.terms_accepted = REQUIRED.terms_accepted;
}

function petErrors(form: FormData): Errors {
  const errors: Errors = {};
  checkAccount(form, errors);
  requireText(form, errors, ["name", "breed", "currently_at", "city", "caretaker_name"]);
  requireOneOf(form, errors, "species", SPECIES);
  requireOneOf(form, errors, "province", PROVINCES);

  const months = text(form, "approximate_age_months");
  const ageProblem = approximateAgeProblem(months ? Number(months) : null);
  if (ageProblem) errors.approximate_age_months = ageProblem;

  const photos = files(form, "photos[]");
  if (photos.length === 0) errors.photos = REQUIRED.photos;
  else if (photos.length > MAX_SIGN_UP_PET_PHOTOS) errors.photos = `Add up to ${MAX_SIGN_UP_PET_PHOTOS} photos.`;
  // Laravel names an array item's error by its position: "photos.0".
  photos.forEach((photo, index) => {
    const problem = fileProblem(photo, "photo");
    if (problem) errors[`photos.${index}`] = problem;
  });

  const contactProblem = contactNumberProblem(text(form, "caretaker_contact_number"));
  if (contactProblem) errors.caretaker_contact_number = contactProblem;
  checkDocument(form, errors, "valid_id", true);
  checkDocument(form, errors, "vet_record", false);
  checkTerms(form, errors);
  return errors;
}

function humanErrors(form: FormData): Errors {
  const errors: Errors = {};
  checkAccount(form, errors);
  requireText(form, errors, ["full_name", "city", "street_address"]);
  requireOneOf(form, errors, "province", PROVINCES);
  requireOneOf(form, errors, "id_type", ID_TYPES);

  const birthProblem = birthdateProblem(text(form, "birthdate"), new Date());
  if (birthProblem) errors.birthdate = birthProblem;
  const contactProblem = contactNumberProblem(text(form, "contact_number"));
  if (contactProblem) errors.contact_number = contactProblem;
  checkDocument(form, errors, "valid_id", true);
  checkTerms(form, errors);
  return errors;
}

// 201 with the new account, Pending Verification and already signed in, so the frontend can go straight to the
// account-status screen (AU-18).
function signUp(validate: (form: FormData) => Errors, persona: MockPersonaId) {
  return ({ body, account }: MockContext): MockResult => {
    if (account) return fail(403, SIGNED_IN);
    const errors = validate(body instanceof FormData ? body : new FormData());
    if (Object.keys(errors).length) return validationFailed(errors);
    return { ...ok(resolveMockAccount(persona), 201), persona };
  };
}

export const signUpRoutes: MockRoute[] = [
  route("POST", AUTH_ENDPOINTS.signUpPet, signUp(petErrors, "pet-pending"), "public"),
  route("POST", AUTH_ENDPOINTS.signUpHuman, signUp(humanErrors, "human-pending"), "public"),
];
