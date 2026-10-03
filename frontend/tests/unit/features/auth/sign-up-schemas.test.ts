import { describe, expect, it } from "vitest";
import {
  EMPTY_HUMAN_SIGN_UP,
  EMPTY_PET_SIGN_UP,
  HUMAN_STEP_FIELDS,
  type HumanSignUpValues,
  PET_STEP_FIELDS,
  type PetSignUpValues,
  approximateAgeMonths,
  formatApproximateAge,
  formatBirthdate,
  placeFieldErrors,
  toHumanSignUpForm,
  toPetSignUpForm,
  validateHumanStep,
  validatePetStep,
} from "@/features/auth/schemas/sign-up-schemas";

const TODAY = new Date(2026, 9, 3);
const file = (name: string, type: string) => new File(["x"], name, { type });

const PET: PetSignUpValues = {
  email: " Caretaker@Example.com ",
  password: "mochi2026",
  password_confirmation: "mochi2026",
  name: " Mochi ",
  species: "dog",
  breed: "Aspin",
  age_amount: "2",
  age_unit: "years",
  currently_at: "Happy Paws Rescue foster",
  city: "Quezon City",
  province: "Metro Manila",
  photos: [file("mochi-1.jpg", "image/jpeg"), file("mochi-2.png", "image/png")],
  caretaker_name: "Joy Lim",
  caretaker_contact_number: "0917 123 4567",
  valid_id: file("id.jpg", "image/jpeg"),
  vet_record: null,
  terms_accepted: true,
};

const HUMAN: HumanSignUpValues = {
  email: "ana@example.com",
  password: "adopt2026",
  password_confirmation: "adopt2026",
  full_name: "Ana Santos",
  birthdate: "1990-03-04",
  contact_number: "+63 917 123 4567",
  city: "Quezon City",
  province: "Metro Manila",
  street_address: " 12 Mabini St ",
  id_type: "drivers_license",
  valid_id: file("license.pdf", "application/pdf"),
  terms_accepted: true,
};

describe("sign-up schemas (mirror the sign-up Form Requests)", () => {
  it("passes complete pet and human sign-ups on every step", () => {
    for (const step of [0, 1, 2, 3, 4]) {
      expect(validatePetStep(step, PET)).toEqual({});
      expect(validateHumanStep(step, HUMAN, TODAY)).toEqual({});
    }
  });

  it("checks the account step: email, password rules, matching confirmation", () => {
    expect(validatePetStep(0, EMPTY_PET_SIGN_UP)).toEqual({
      email: "Enter your email.",
      password: "Enter a password.",
      password_confirmation: "Confirm your password.",
    });
    expect(validateHumanStep(0, { ...HUMAN, password: "short1", password_confirmation: "short1" }).password).toBe(
      "Use at least 8 characters.",
    );
    expect(validateHumanStep(0, { ...HUMAN, password_confirmation: "adopt2027" })).toEqual({
      password_confirmation: "The passwords don't match.",
    });
  });

  it("names each missing pet detail, keyed by the API's field", () => {
    expect(validatePetStep(1, EMPTY_PET_SIGN_UP)).toEqual({
      name: "Enter the pet's name.",
      species: "Choose a species.",
      breed: 'Enter the breed, or "Mixed" if you\'re not sure.',
      currently_at: "Enter where the pet is staying.",
      city: "Enter the city.",
      province: "Choose a province.",
      approximate_age_months: "Enter the pet's approximate age.",
    });
    expect(validatePetStep(1, { ...PET, age_amount: "31" }).approximate_age_months).toBe("Enter an age of 30 years or less.");
    expect(validatePetStep(1, { ...PET, province: "NCR" })).toEqual({ province: "Choose a province." });
  });

  it("needs a photo, a caretaker with a mobile number and a valid ID; the vet record is optional", () => {
    expect(validatePetStep(2, EMPTY_PET_SIGN_UP)).toEqual({ photos: "Add at least one clear photo of the pet." });
    expect(validatePetStep(3, EMPTY_PET_SIGN_UP)).toEqual({
      caretaker_name: "Enter the caretaker's full name.",
      caretaker_contact_number: "Enter a mobile number.",
      valid_id: "Upload a photo of the valid ID.",
    });
    expect(validatePetStep(3, { ...PET, vet_record: null })).toEqual({});
  });

  it("stops a human under 18 on the personal details step", () => {
    expect(validateHumanStep(1, { ...HUMAN, birthdate: "2008-10-04" }, TODAY)).toEqual({
      birthdate: "You must be 18 or older to adopt on Pawfolio.",
    });
    expect(validateHumanStep(1, { ...HUMAN, birthdate: "2008-10-03" }, TODAY)).toEqual({});
    expect(validateHumanStep(1, EMPTY_HUMAN_SIGN_UP, TODAY)).toEqual({
      full_name: "Enter your full name.",
      birthdate: "Enter your birthdate.",
      contact_number: "Enter a mobile number.",
    });
  });

  it("needs the address, the ID type with its photo, and the agreement", () => {
    expect(validateHumanStep(2, EMPTY_HUMAN_SIGN_UP)).toEqual({
      city: "Enter the city.",
      street_address: "Enter your street address.",
      province: "Choose a province.",
    });
    expect(validateHumanStep(3, EMPTY_HUMAN_SIGN_UP)).toEqual({
      id_type: "Choose the type of ID.",
      valid_id: "Upload a photo of the valid ID.",
    });
    expect(validateHumanStep(4, EMPTY_HUMAN_SIGN_UP).terms_accepted).toMatch(/Terms and Community Guidelines/);
    expect(validatePetStep(4, EMPTY_PET_SIGN_UP).terms_accepted).toMatch(/Terms and Community Guidelines/);
  });

  it("turns the typed age into months", () => {
    expect(approximateAgeMonths("2", "years")).toBe(24);
    expect(approximateAgeMonths("8", "months")).toBe(8);
    expect(approximateAgeMonths(" ", "years")).toBeNull();
    expect(formatApproximateAge("1", "years")).toBe("1 year");
    expect(formatApproximateAge("8", "months")).toBe("8 months");
    expect(formatApproximateAge("", "years")).toBe("");
    expect(formatBirthdate("1990-03-04")).toBe("Mar 4, 1990");
    expect(formatBirthdate("")).toBe("");
  });

  it("sends a 422's errors to the step that shows the field", () => {
    expect(placeFieldErrors(PET_STEP_FIELDS, { "photos.1": "Upload a JPG or PNG photo.", valid_id: "Too large." })).toEqual({
      errors: { photos: "Upload a JPG or PNG photo.", valid_id: "Too large." },
      firstStep: 2,
      unplaced: [],
    });
    expect(placeFieldErrors(HUMAN_STEP_FIELDS, { birthdate: "Under 18.", email: "Taken." }).firstStep).toBe(0);
    expect(placeFieldErrors(HUMAN_STEP_FIELDS, { role: "Not allowed." })).toEqual({
      errors: {},
      firstStep: null,
      unplaced: ["Not allowed."],
    });
  });

  it("builds the pet body: trimmed, lower-case email, months, normalized number, photos as an array", () => {
    const form = toPetSignUpForm(PET);
    expect(form.get("email")).toBe("caretaker@example.com");
    expect(form.get("name")).toBe("Mochi");
    expect(form.get("approximate_age_months")).toBe("24");
    expect(form.get("caretaker_contact_number")).toBe("09171234567");
    expect(form.getAll("photos[]")).toHaveLength(2);
    expect((form.get("valid_id") as File).name).toBe("id.jpg");
    expect(form.has("vet_record")).toBe(false);
    expect(form.get("terms_accepted")).toBe("1");
    // The role and the account status are the server's to set (SEC-INPUT-04).
    expect(form.has("role")).toBe(false);
    expect(form.has("status")).toBe(false);
    // The UI-only fields don't leak into the request.
    expect(form.has("age_amount")).toBe(false);
  });

  it("builds the human body", () => {
    const form = toHumanSignUpForm(HUMAN);
    expect(form.get("birthdate")).toBe("1990-03-04");
    expect(form.get("contact_number")).toBe("09171234567");
    expect(form.get("street_address")).toBe("12 Mabini St");
    expect(form.get("id_type")).toBe("drivers_license");
    expect((form.get("valid_id") as File).type).toBe("application/pdf");
    expect(form.has("role")).toBe(false);
  });
});
