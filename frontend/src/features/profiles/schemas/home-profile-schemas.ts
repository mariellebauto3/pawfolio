import { PROVINCES } from "@/constants/provinces";
import type { FieldErrors } from "@/lib/api/errors";
import type {
  ActivityLevel,
  AgeGroup,
  HomeProfile,
  HomeType,
  HoursAway,
  HouseholdMember,
  OtherPet,
  OutdoorSpace,
  PetExperience,
  SpecialNeedsWillingness,
} from "@/types/home-profile";
import type { PetSize, Species } from "@/types/pet";
import type { OwnHomeProfile } from "../types/own-home-profile";

// Client rules for the Home Profile & lifestyle quiz (PR-14…PR-19) and the Edit intro dialog (PR-12), mirroring
// `PATCH /me/home-profile/{step}` and `POST /me/home-profile/intro` (docs/api/profiles-and-matching.md). They give
// quick feedback; the API is the authority.

export { resumeFieldErrors as quizFieldErrors } from "./resume-schemas";

export const QUIZ_STEPS = ["Household", "Home & space", "Lifestyle", "Experience", "Preferences", "Review"] as const;

export const QUIZ_REVIEW_STEP = QUIZ_STEPS.length - 1;

export const HOME_PROFILE_LIMITS = {
  headline: 140,
  about_home: 1000,
  city: 80,
} as const;

/** The quiz answers as the form holds them: an empty string is "not answered yet". */
export type QuizValues = {
  household_members: HouseholdMember[];
  other_pets: OtherPet[];
  about_home: string;
  home_type: HomeType | "";
  outdoor_space: OutdoorSpace | "";
  city: string;
  province: string;
  activity_level: ActivityLevel | "";
  hours_away: HoursAway | "";
  pet_experience: PetExperience | "";
  special_needs_willingness: SpecialNeedsWillingness | "";
  accepted_species: Species[];
  preferred_sizes: PetSize[];
  preferred_ages: AgeGroup[];
};

export type QuizField = keyof QuizValues;

/** The fields each step saves. The review step saves nothing through the form. */
export const QUIZ_STEP_FIELDS: readonly (readonly QuizField[])[] = [
  ["household_members", "other_pets", "about_home"],
  ["home_type", "outdoor_space", "city", "province"],
  ["activity_level", "hours_away"],
  ["pet_experience", "special_needs_willingness"],
  ["accepted_species", "preferred_sizes", "preferred_ages"],
  [],
];

export function quizValuesFrom(home: OwnHomeProfile): QuizValues {
  return {
    household_members: home.household_members,
    other_pets: home.other_pets,
    about_home: home.about_home ?? "",
    home_type: home.home_type ?? "",
    outdoor_space: home.outdoor_space ?? "",
    city: home.city ?? "",
    province: home.province ?? "",
    activity_level: home.activity_level ?? "",
    hours_away: home.hours_away ?? "",
    pet_experience: home.pet_experience ?? "",
    special_needs_willingness: home.special_needs_willingness ?? "",
    accepted_species: home.accepted_species,
    preferred_sizes: home.preferred_sizes,
    preferred_ages: home.preferred_ages,
  };
}

/** The answers the API asks for before it takes a step. The rest (other pets, size, age, about) may stay open. */
const REQUIRED: Partial<Record<QuizField, string>> = {
  household_members: "Choose who lives with you.",
  home_type: "Choose a home type.",
  outdoor_space: "Choose your outdoor space.",
  activity_level: "Choose an activity level.",
  hours_away: "Choose how long you're away on a usual day.",
  pet_experience: "Choose your experience with pets.",
  special_needs_willingness: "Choose Yes, Minor needs only or No.",
  accepted_species: "Choose at least one species.",
};

const isEmpty = (value: QuizValues[QuizField]) => (Array.isArray(value) ? value.length === 0 : !value.trim());

/**
 * What is wrong with a step. Next takes a step only when every question the match needs is answered (`strict`);
 * Save draft on a quiz that isn't finished checks only what was typed, so the human can stop halfway.
 */
export function validateQuizStep(step: number, values: QuizValues, strict: boolean): FieldErrors {
  const errors: FieldErrors = {};
  const fields = QUIZ_STEP_FIELDS[step] ?? [];
  const has = (field: QuizField) => fields.includes(field);

  // The API never accepts these two empty: they were filled in at sign-up.
  if (has("city")) {
    if (!values.city.trim()) errors.city = "Enter your city.";
    else if (values.city.trim().length > HOME_PROFILE_LIMITS.city) errors.city = `Keep the city to ${HOME_PROFILE_LIMITS.city} characters or fewer.`;
  }
  if (has("province") && !(PROVINCES as readonly string[]).includes(values.province)) errors.province = "Choose a province.";
  if (has("about_home") && values.about_home.trim().length > HOME_PROFILE_LIMITS.about_home) {
    errors.about_home = `Keep this to ${HOME_PROFILE_LIMITS.about_home} characters or fewer.`;
  }

  if (strict) {
    for (const field of fields) {
      const message = REQUIRED[field];
      if (message && isEmpty(values[field]) && !errors[field]) errors[field] = message;
    }
  }
  return errors;
}

/** The JSON body that saves one step with Next: every field of the step, text trimmed. */
export function quizStepPayload(step: number, values: QuizValues): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const field of QUIZ_STEP_FIELDS[step] ?? []) {
    const value = values[field];
    if (Array.isArray(value)) body[field] = value;
    else if (field === "about_home") body[field] = value.trim() || null;
    else body[field] = value.trim();
  }
  return body;
}

/**
 * The body Save draft sends on a quiz that isn't finished: the step without its unanswered required questions,
 * which the API would refuse. Lists that may be empty (other pets, size, age) are always sent, so "None" saves.
 */
export function quizDraftPayload(step: number, values: QuizValues): Record<string, unknown> {
  const body = quizStepPayload(step, values);
  for (const field of QUIZ_STEP_FIELDS[step] ?? []) {
    if (REQUIRED[field] && isEmpty(values[field])) delete body[field];
  }
  return body;
}

/**
 * Whether two sets of answers (form values, or request bodies) say the same thing. A list counts as a set: the API
 * may give its items back in another order than they were picked in.
 */
export function sameAnswers(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const normal = (answers: Record<string, unknown>) => JSON.stringify(answers, (_key, value) => (Array.isArray(value) ? [...value].sort() : value));
  return normal(a) === normal(b);
}

type QuizAnswers = Pick<
  HomeProfile,
  | "household_members"
  | "home_type"
  | "outdoor_space"
  | "activity_level"
  | "hours_away"
  | "pet_experience"
  | "special_needs_willingness"
  | "accepted_species"
>;

/** Whether each of the five question steps has the answers the match needs, in step order. */
export function quizStepsDone(home: QuizAnswers): boolean[] {
  return [
    home.household_members.length > 0,
    Boolean(home.home_type && home.outdoor_space),
    Boolean(home.activity_level && home.hours_away),
    Boolean(home.pet_experience && home.special_needs_willingness),
    home.accepted_species.length > 0,
  ];
}

/** The first step with a question still open, for "Continue the quiz" (PR-11); the review step when none. */
export function firstOpenQuizStep(home: QuizAnswers): number {
  const open = quizStepsDone(home).indexOf(false);
  return open === -1 ? QUIZ_REVIEW_STEP : open;
}

/** A step from `?step=` (1-based in the URL, so it reads like "Step 2 of 6"), or null when it isn't one. */
export function quizStepFromParam(param: string | string[] | undefined): number | null {
  const value = Number(Array.isArray(param) ? param[0] : param);
  return Number.isInteger(value) && value >= 1 && value <= QUIZ_STEPS.length ? value - 1 : null;
}

/**
 * What the match score is made of (proposal §6, PR-19): the seven weighted answers, 100 points in all, in the order
 * the quiz asks them. `step` is the quiz step that holds the answer. Mirrors the backend's MatchScoreCalculator.
 */
export const MATCH_WEIGHTS = [
  { key: "activity", label: "Activity level", against: "the pet's energy level", points: 20, step: 2 },
  { key: "hours_away", label: "Hours away", against: "how long the pet can be left alone", points: 15, step: 2 },
  { key: "space", label: "Home & space", against: "the space the pet needs", points: 15, step: 1 },
  { key: "experience", label: "Experience", against: "the experience the pet needs", points: 15, step: 3 },
  { key: "size_age", label: "Size & age", against: "the pet's size and age", points: 15, step: 4 },
  { key: "compatibility", label: "Kids & other pets", against: "who the pet is good with", points: 10, step: 0 },
  { key: "special_needs", label: "Special needs", against: "the care the pet needs", points: 10, step: 3 },
] as const;

export type IntroValues = { headline: string; about_home: string };

/** What is wrong with the Edit intro form (PR-12). Both texts may be left empty. */
export function validateIntro(values: IntroValues): FieldErrors {
  const errors: FieldErrors = {};
  if (values.headline.trim().length > HOME_PROFILE_LIMITS.headline) {
    errors.headline = `Keep the headline to ${HOME_PROFILE_LIMITS.headline} characters or fewer.`;
  }
  if (values.about_home.trim().length > HOME_PROFILE_LIMITS.about_home) {
    errors.about_home = `Keep this to ${HOME_PROFILE_LIMITS.about_home} characters or fewer.`;
  }
  return errors;
}

/** What the profile checklist on My Home Profile ticks off (PR-11), in the order it lists them. */
export function profileChecklist(home: OwnHomeProfile): { key: "intro" | "quiz" | "slots" | "photo"; done: boolean }[] {
  return [
    { key: "intro", done: Boolean(home.about_home?.trim()) },
    { key: "quiz", done: home.has_completed_quiz },
    { key: "slots", done: home.open_slots_count > 0 },
    { key: "photo", done: Boolean(home.profile_photo_url) },
  ];
}
