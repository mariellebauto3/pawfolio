import { PROVINCES } from "@/constants/provinces";
import type { FieldErrors } from "@/lib/api/errors";
import type {
  EnergyLevel,
  ExperienceNeeded,
  GoodWith,
  Pet,
  PetSex,
  PetSize,
  PetSkill,
  PetSpecialNeed,
  SpaceNeeds,
  TimeAlone,
} from "@/types/pet";
import { RESUME_REQUIREMENTS, type ResumeCompleteness, type ResumeRequirement } from "../types/own-pet";

// Client rules for the edit resume wizard (PR-03…PR-08), mirroring `PATCH /me/pet` and the publish checklist
// (docs/api/profiles-and-matching.md). They give quick feedback; the API is the authority.

export const RESUME_STEPS = ["Basics", "Photos", "About & temperament", "Skills & compatibility", "Health", "Review & publish"] as const;

export const PHOTOS_STEP = 1;
export const REVIEW_STEP = RESUME_STEPS.length - 1;

/** The wizard step that settles each publish requirement. */
export const REQUIREMENT_STEP = {
  basics: 0,
  photos: PHOTOS_STEP,
  about_temperament: 2,
  compatibility: 3,
  health: 4,
} as const satisfies Record<ResumeRequirement, number>;

export const REQUIREMENT_LABELS = {
  basics: "Basics",
  photos: "Photos",
  about_temperament: "Bio & temperament",
  compatibility: "Compatibility",
  health: "Health",
} as const satisfies Record<ResumeRequirement, string>;

export const RESUME_LIMITS = {
  currently_at: 120,
  city: 80,
  bioMin: 50,
  bioMax: 600,
  health_notes: 2000,
  temperamentTags: 5,
  caption: 140,
  minPhotos: 3,
  maxPhotos: 10,
  maxVetRecords: 5,
} as const;

/** The editable fields as the form holds them: an empty string is "not answered yet". */
export type ResumeValues = {
  sex: PetSex | "";
  size: PetSize | "";
  currently_at: string;
  city: string;
  province: string;
  bio: string;
  temperament_tags: string[];
  energy_level: EnergyLevel | "";
  skills: PetSkill[];
  good_with_kids: GoodWith | "";
  good_with_dogs: GoodWith | "";
  good_with_cats: GoodWith | "";
  time_alone: TimeAlone | "";
  space_needs: SpaceNeeds | "";
  experience_needed: ExperienceNeeded | "";
  health_notes: string;
  special_needs: PetSpecialNeed[];
};

export type ResumeField = keyof ResumeValues;

/** The fields each step saves. The photos and review steps save nothing through the form. */
export const STEP_FIELDS: readonly (readonly ResumeField[])[] = [
  ["sex", "size", "currently_at", "city", "province"],
  [],
  ["bio", "temperament_tags", "energy_level"],
  ["skills", "good_with_kids", "good_with_dogs", "good_with_cats", "time_alone", "space_needs", "experience_needed"],
  ["health_notes", "special_needs"],
  [],
];

export function resumeValuesFrom(pet: Pet): ResumeValues {
  return {
    sex: pet.sex ?? "",
    size: pet.size ?? "",
    currently_at: pet.currently_at ?? "",
    city: pet.city ?? "",
    province: pet.province ?? "",
    bio: pet.bio ?? "",
    temperament_tags: pet.temperament_tags,
    energy_level: pet.energy_level ?? "",
    skills: pet.skills,
    good_with_kids: pet.good_with_kids ?? "",
    good_with_dogs: pet.good_with_dogs ?? "",
    good_with_cats: pet.good_with_cats ?? "",
    time_alone: pet.time_alone ?? "",
    space_needs: pet.space_needs ?? "",
    experience_needed: pet.experience_needed ?? "",
    health_notes: pet.health_notes ?? "",
    special_needs: pet.special_needs,
  };
}

const REQUIRED: Partial<Record<ResumeField, string>> = {
  sex: "Choose the pet's sex.",
  size: "Choose a size.",
  bio: "Write a short bio in the pet's own voice.",
  temperament_tags: "Pick at least one temperament tag.",
  energy_level: "Choose an energy level.",
  good_with_kids: "Choose Yes, No or Unknown.",
  good_with_dogs: "Choose Yes, No or Unknown.",
  good_with_cats: "Choose Yes, No or Unknown.",
  time_alone: "Choose how long the pet can be left alone.",
  space_needs: "Choose the space the pet needs.",
  experience_needed: "Choose the experience a home needs.",
  health_notes: "Add a health note, such as vaccinations and spay or neuter status.",
};

/**
 * What is wrong with a step. A Draft may leave answers open and come back later, so only what was typed is checked;
 * once the resume is published (`complete`), everything a published resume needs must stay filled in.
 */
export function validateResumeStep(step: number, values: ResumeValues, complete: boolean): FieldErrors {
  const errors: FieldErrors = {};
  const fields = STEP_FIELDS[step] ?? [];
  const has = (field: ResumeField) => fields.includes(field);

  // The API never accepts these three empty, Draft or not: they were filled in at sign-up.
  if (has("currently_at") && !values.currently_at.trim()) errors.currently_at = "Enter where the pet is staying.";
  if (has("city") && !values.city.trim()) errors.city = "Enter the city.";
  if (has("province") && !(PROVINCES as readonly string[]).includes(values.province)) errors.province = "Choose a province.";

  if (has("bio")) {
    const length = values.bio.trim().length;
    if (length > 0 && length < RESUME_LIMITS.bioMin) errors.bio = `Write at least ${RESUME_LIMITS.bioMin} characters.`;
    else if (length > RESUME_LIMITS.bioMax) errors.bio = `Keep the bio to ${RESUME_LIMITS.bioMax} characters or fewer.`;
  }
  if (has("temperament_tags") && values.temperament_tags.length > RESUME_LIMITS.temperamentTags) {
    errors.temperament_tags = `Pick up to ${RESUME_LIMITS.temperamentTags} tags.`;
  }
  if (has("health_notes") && values.health_notes.trim().length > RESUME_LIMITS.health_notes) {
    errors.health_notes = `Keep the notes to ${RESUME_LIMITS.health_notes} characters or fewer.`;
  }

  if (complete) {
    for (const field of fields) {
      const message = REQUIRED[field];
      const value = values[field];
      const empty = Array.isArray(value) ? value.length === 0 : !value.trim();
      if (message && empty && !errors[field]) errors[field] = message;
    }
  }
  return errors;
}

const TEXT_FIELDS = new Set<ResumeField>(["currently_at", "city", "province", "bio", "health_notes"]);

/** The JSON body that saves one step: text trimmed, an unanswered question sent as `null`. */
export function resumeStepPayload(step: number, values: ResumeValues): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const field of STEP_FIELDS[step] ?? []) {
    const value = values[field];
    if (Array.isArray(value)) body[field] = value;
    else if (TEXT_FIELDS.has(field)) body[field] = value.trim() || null;
    else body[field] = value || null;
  }
  return body;
}

/** Puts an API error such as `temperament_tags.0` on the field the form shows it under. */
export function resumeFieldErrors(errors: FieldErrors): FieldErrors {
  const placed: FieldErrors = {};
  for (const [key, message] of Object.entries(errors)) {
    const field = key.split(".")[0];
    if (!placed[field]) placed[field] = message;
  }
  return placed;
}

/** The first step with something still to do, for "Continue editing" on a Draft (PR-02); the review step when none. */
export function firstOpenStep(completeness: ResumeCompleteness): number {
  const open = RESUME_REQUIREMENTS.find((requirement) => !completeness.steps[requirement]);
  return open ? REQUIREMENT_STEP[open] : REVIEW_STEP;
}

/** A step from `?step=` (1-based in the URL, so it reads like "Step 2 of 6"), or null when it isn't one. */
export function stepFromParam(param: string | string[] | undefined): number | null {
  const value = Number(Array.isArray(param) ? param[0] : param);
  return Number.isInteger(value) && value >= 1 && value <= RESUME_STEPS.length ? value - 1 : null;
}

/** Moves one photo id to a new place in the order (PR-04 "Move", "Make profile photo"). */
export function movePhoto(ids: readonly number[], id: number, to: number): number[] {
  const from = ids.indexOf(id);
  const target = Math.min(Math.max(to, 0), ids.length - 1);
  if (from === -1 || from === target) return [...ids];
  const next = ids.filter((other) => other !== id);
  next.splice(target, 0, id);
  return next;
}

/**
 * The part of a photo a 4:3 crop keeps (PR-09), in the photo's own pixels. `zoom` 1 keeps as much as fits; `panX`
 * and `panY` run from -1 (left / top edge) to 1 (right / bottom edge), 0 being the middle.
 */
export function cropRect(width: number, height: number, zoom: number, panX: number, panY: number) {
  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
  const scale = clamp(zoom, 1, 4);
  const cropWidth = Math.min(width, (height * 4) / 3) / scale;
  const cropHeight = (cropWidth * 3) / 4;
  return {
    x: ((width - cropWidth) / 2) * (1 + clamp(panX, -1, 1)),
    y: ((height - cropHeight) / 2) * (1 + clamp(panY, -1, 1)),
    width: cropWidth,
    height: cropHeight,
  };
}
