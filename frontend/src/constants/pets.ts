import type { StatusName } from "@/constants/status-badges";
import type {
  EnergyLevel,
  ExperienceNeeded,
  GoodWith,
  PetSex,
  PetSize,
  PetSkill,
  PetSpecialNeed,
  SpaceNeeds,
  Species,
  TimeAlone,
} from "@/types/pet";
import type { PetStatus } from "@/types/statuses";

// Display names for the API's pet values, worded as the LoFi words them (PR-03…PR-07).

export const SPECIES_LABELS = {
  dog: "Dog",
  cat: "Cat",
  other: "Other",
} as const satisfies Record<Species, string>;

/** The status badge for each pet status. The status itself only ever comes from the API (FR27). */
export const PET_STATUS_NAMES = {
  draft: "Draft",
  looking_for_a_home: "Looking for a Home",
  in_process: "In Process",
  adopted_hired: "Hired",
} as const satisfies Record<PetStatus, StatusName>;

export const PET_SEX_LABELS = { female: "Female", male: "Male" } as const satisfies Record<PetSex, string>;

export const PET_SIZE_LABELS = { small: "Small", medium: "Medium", large: "Large" } as const satisfies Record<PetSize, string>;

export const ENERGY_LEVEL_LABELS = { low: "Low", medium: "Medium", high: "High" } as const satisfies Record<EnergyLevel, string>;

export const GOOD_WITH_LABELS = { yes: "Yes", no: "No", unknown: "Unknown" } as const satisfies Record<GoodWith, string>;

export const TIME_ALONE_LABELS = {
  up_to_2_hrs: "Up to 2 hrs",
  up_to_4_hrs: "Up to 4 hrs",
  up_to_6_hrs: "Up to 6 hrs",
  "8_plus_hrs": "8+ hrs",
} as const satisfies Record<TimeAlone, string>;

export const SPACE_NEEDS_LABELS = {
  apartment_ok: "Apartment OK",
  needs_yard_or_daily_walks: "Needs a yard or daily walks",
  ground_floor: "Ground floor",
} as const satisfies Record<SpaceNeeds, string>;

export const EXPERIENCE_NEEDED_LABELS = {
  first_time_ok: "First-time OK",
  some_experience: "Some experience",
  experienced_only: "Experienced only",
} as const satisfies Record<ExperienceNeeded, string>;

export const PET_SKILL_LABELS = {
  sit_and_stay: "Sit & stay",
  leash_trained: "Leash-trained",
  potty_trained: "Potty-trained",
  crate_trained: "Crate-trained",
  litter_trained: "Litter-trained",
  comes_when_called: "Comes when called",
  house_trained: "House-trained",
  quiet_at_night: "Quiet at night",
  scratching_post_only: "Uses a scratching post",
  sit: "Sit",
  shake: "Shake",
  learning_sit: "Learning to sit",
  potty_training_in_progress: "Potty training in progress",
} as const satisfies Record<PetSkill, string>;

export const SPECIAL_NEED_LABELS = {
  daily_meds: "Daily meds",
  special_diet: "Special diet",
  mobility_support: "Mobility support",
} as const satisfies Record<PetSpecialNeed, string>;

/** The temperament tags a resume can pick from, up to five (PR-05). */
export const TEMPERAMENT_TAGS = ["Playful", "Calm", "Loyal", "Curious", "Gentle", "Shy", "Cuddly", "Independent", "Chatty"] as const;

/** `{ value, label }` pairs for a Select or ChoiceChips, in the order the labels are listed. */
export function optionsFrom<V extends string>(labels: Record<V, string>): { value: V; label: string }[] {
  return (Object.keys(labels) as V[]).map((value) => ({ value, label: labels[value] }));
}
