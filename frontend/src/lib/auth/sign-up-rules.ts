// Sign-up rules (AU-08…AU-17) shared by the wizards' client checks and the mock API, mirroring the sign-up Form
// Requests and their messages (docs/api/auth.md). They give quick feedback; the API is the authority.

/** Humans must be 18 or older (proposal §5.1, SEC-INPUT-05). */
export const MIN_ADOPTER_AGE = 18;

/** A pet sign-up needs 1 to 3 photos (AU-10, SEC-FILE-02). */
export const MAX_SIGN_UP_PET_PHOTOS = 3;

export const MAX_UPLOAD_MB = 5;

export const MAX_PET_AGE_MONTHS = 30 * 12;

/** Longest value the API accepts per text field; the inputs stop at the same length. */
export const SIGN_UP_TEXT_LIMITS = {
  email: 255,
  name: 50,
  breed: 80,
  currently_at: 120,
  city: 80,
  caretaker_name: 120,
  full_name: 120,
  street_address: 255,
} as const;

/** What the API answers when a required field is missing, by field name. */
export const SIGN_UP_REQUIRED_MESSAGES = {
  email: "Enter your email.",
  password: "Enter a password.",
  name: "Enter the pet's name.",
  species: "Choose a species.",
  breed: 'Enter the breed, or "Mixed" if you\'re not sure.',
  currently_at: "Enter where the pet is staying.",
  city: "Enter the city.",
  province: "Choose a province.",
  photos: "Add at least one clear photo of the pet.",
  caretaker_name: "Enter the caretaker's full name.",
  full_name: "Enter your full name.",
  street_address: "Enter your street address.",
  id_type: "Choose the type of ID.",
  valid_id: "Upload a photo of the valid ID.",
  terms_accepted: "Confirm the details and agree to the Terms and Community Guidelines to continue.",
} as const;

export type SignUpRequiredField = keyof typeof SIGN_UP_REQUIRED_MESSAGES;

/**
 * A Philippine mobile number as the API stores it ("09171234567"), or null when it isn't one. Accepts the ways people
 * write it: "0917 123 4567", "0917-123-4567", "+63 917 123 4567".
 */
export function normalizeContactNumber(value: string): string | null {
  const match = /^(?:\+?63|0)(9\d{9})$/.exec(value.replace(/[\s\-().]/g, ""));
  return match ? `0${match[1]}` : null;
}

export function contactNumberProblem(value: string): string | null {
  if (!value.trim()) return "Enter a mobile number.";
  return normalizeContactNumber(value) ? null : "Enter a mobile number like 0917 123 4567.";
}

/** Full years between a "YYYY-MM-DD" birthdate and `today`, or null when it isn't a real date. */
export function ageOn(birthdate: string, today: Date): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthdate);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  // Rejects dates the calendar doesn't have, such as 31 February, which Date would roll into March.
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  const hadBirthday = today.getMonth() > month - 1 || (today.getMonth() === month - 1 && today.getDate() >= day);
  return today.getFullYear() - year - (hadBirthday ? 0 : 1);
}

export function birthdateProblem(birthdate: string, today: Date): string | null {
  if (!birthdate) return "Enter your birthdate.";
  const age = ageOn(birthdate, today);
  if (age === null || age < 0 || age > 120) return "Enter a valid birthdate.";
  if (age < MIN_ADOPTER_AGE) return `You must be ${MIN_ADOPTER_AGE} or older to adopt on Pawfolio.`;
  return null;
}

export function approximateAgeProblem(months: number | null): string | null {
  if (months === null) return "Enter the pet's approximate age.";
  if (!Number.isInteger(months) || months < 1) return "Enter a whole number, 1 or more. Use months for a pet under a year old.";
  if (months > MAX_PET_AGE_MONTHS) return "Enter an age of 30 years or less.";
  return null;
}
