import { describe, expect, it } from "vitest";
import {
  HUMAN_SUBMISSION_FIELDS,
  PET_SUBMISSION_FIELDS,
  humanSubmissionValues,
  petSubmissionValues,
  splitApproximateAge,
  toHumanSubmissionForm,
  toPetSubmissionForm,
  validateHumanSubmission,
  validatePetSubmission,
} from "@/features/auth/schemas/submission-schemas";
import { approximateAgeMonths, placeFieldErrors } from "@/features/auth/schemas/sign-up-schemas";
import type { HumanSubmission, PetSubmission, SubmittedDocument } from "@/types/account-status";

const TODAY = new Date(2026, 9, 3);
const SENT = "2026-09-29T06:48:00.000000Z";
const file = (name: string, type: string) => new File(["x"], name, { type });

const document = (document_type: SubmittedDocument["document_type"], id_type: SubmittedDocument["id_type"] = null): SubmittedDocument => ({
  document_type,
  id_type,
  mime_type: "image/jpeg",
  size_bytes: 1000,
  uploaded_at: SENT,
});

const PET: PetSubmission = {
  role: "pet",
  name: "Kulit",
  species: "cat",
  breed: "Puspin",
  approximate_age_months: 8,
  currently_at: "With the finder",
  city: "Pasig",
  province: "Metro Manila",
  caretaker_name: "Joy Lim",
  caretaker_contact_number: "09170000014",
  documents: [document("valid_id"), document("pet_photo")],
};

const HUMAN: HumanSubmission = {
  role: "human",
  full_name: "Carla Mendoza",
  birthdate: "1994-11-22",
  contact_number: "09170000015",
  city: "Pasig",
  province: "Metro Manila",
  street_address: "Unit 4B, 18 Sampaguita St",
  documents: [document("valid_id", "umid")],
};

describe("submission schemas (mirror PATCH /account/submission)", () => {
  it("splits an age into the number and unit the form shows, and back", () => {
    expect(splitApproximateAge(8)).toEqual({ age_amount: "8", age_unit: "months" });
    expect(splitApproximateAge(24)).toEqual({ age_amount: "2", age_unit: "years" });
    expect(splitApproximateAge(30)).toEqual({ age_amount: "30", age_unit: "months" });
    for (const months of [1, 8, 12, 30, 60, 360]) {
      const { age_amount, age_unit } = splitApproximateAge(months);
      expect(approximateAgeMonths(age_amount, age_unit)).toBe(months);
    }
  });

  it("fills the form with what was submitted, with no file chosen", () => {
    expect(petSubmissionValues(PET)).toMatchObject({
      name: "Kulit",
      species: "cat",
      age_amount: "8",
      age_unit: "months",
      caretaker_contact_number: "09170000014",
      photos: [],
      valid_id: null,
      vet_record: null,
    });
    expect(humanSubmissionValues(HUMAN)).toMatchObject({ full_name: "Carla Mendoza", birthdate: "1994-11-22", id_type: "umid", valid_id: null });
    expect(humanSubmissionValues({ ...HUMAN, documents: [] }).id_type).toBe("");
  });

  it("passes what was submitted without any new file", () => {
    expect(validatePetSubmission(petSubmissionValues(PET))).toEqual({});
    expect(validateHumanSubmission(humanSubmissionValues(HUMAN), TODAY)).toEqual({});
  });

  it("reports every problem at once, keyed by API field", () => {
    const pet = { ...petSubmissionValues(PET), name: " ", age_amount: "", province: "NCR", caretaker_name: "", caretaker_contact_number: "123" };
    expect(validatePetSubmission(pet)).toEqual({
      name: "Enter the pet's name.",
      approximate_age_months: "Enter the pet's approximate age.",
      province: "Choose a province.",
      caretaker_name: "Enter the caretaker's full name.",
      caretaker_contact_number: "Enter a mobile number like 0917 123 4567.",
    });

    const human = { ...humanSubmissionValues(HUMAN), birthdate: "2010-01-01", street_address: "", id_type: "" as const };
    expect(validateHumanSubmission(human, TODAY)).toEqual({
      birthdate: "You must be 18 or older to adopt on Pawfolio.",
      street_address: "Enter your street address.",
      id_type: "Choose the type of ID.",
    });
  });

  it("sends the details trimmed and normalized, and only the files that were chosen", () => {
    const untouched = toPetSubmissionForm({ ...petSubmissionValues(PET), name: " Kulit ", caretaker_contact_number: "+63 917 000 0014" });
    expect(Object.fromEntries(untouched)).toEqual({
      name: "Kulit",
      species: "cat",
      breed: "Puspin",
      approximate_age_months: "8",
      currently_at: "With the finder",
      city: "Pasig",
      province: "Metro Manila",
      caretaker_name: "Joy Lim",
      caretaker_contact_number: "09170000014",
    });

    const replaced = toPetSubmissionForm({
      ...petSubmissionValues(PET),
      photos: [file("a.jpg", "image/jpeg"), file("b.png", "image/png")],
      valid_id: file("id.pdf", "application/pdf"),
    });
    expect(replaced.getAll("photos[]")).toHaveLength(2);
    expect((replaced.get("valid_id") as File).name).toBe("id.pdf");
    expect(replaced.has("vet_record")).toBe(false);

    const human = toHumanSubmissionForm(humanSubmissionValues(HUMAN));
    expect(human.get("id_type")).toBe("umid");
    expect(human.has("valid_id")).toBe(false);
  });

  it("never sends the login, the agreement, a role or a status (SEC-INPUT-04)", () => {
    const sent = [...toPetSubmissionForm(petSubmissionValues(PET)).keys(), ...toHumanSubmissionForm(humanSubmissionValues(HUMAN)).keys()];
    for (const field of ["email", "password", "password_confirmation", "terms_accepted", "role", "status"]) {
      expect(sent).not.toContain(field);
    }
  });

  it("places a 422's errors on the fields the forms show", () => {
    expect(placeFieldErrors([PET_SUBMISSION_FIELDS], { "photos.1": "Upload a JPG or PNG photo.", name: "Enter the pet's name." })).toEqual({
      errors: { photos: "Upload a JPG or PNG photo.", name: "Enter the pet's name." },
      firstStep: 0,
      unplaced: [],
    });
    expect(placeFieldErrors([HUMAN_SUBMISSION_FIELDS], { email: "Not editable here." })).toEqual({
      errors: {},
      firstStep: null,
      unplaced: ["Not editable here."],
    });
  });
});
