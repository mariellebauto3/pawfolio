import { PET_SIZE_LABELS, SPECIES_LABELS } from "@/constants/pets";
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

// Display names for the API's Home Profile values, worded as the LoFi words them (PR-14…PR-18), and the short
// summaries a profile shows instead of raw answers (PR-11, PR-19).

export const HOME_TYPE_LABELS = {
  house: "House",
  condo: "Condo",
  apartment: "Apartment",
  townhouse: "Townhouse",
} as const satisfies Record<HomeType, string>;

export const OUTDOOR_SPACE_LABELS = {
  none: "None",
  balcony: "Balcony",
  small_yard: "Small yard",
  large_yard: "Large yard",
} as const satisfies Record<OutdoorSpace, string>;

export const ACTIVITY_LEVEL_LABELS = {
  relaxed: "Relaxed",
  moderate: "Moderate",
  active: "Active",
  very_active: "Very active",
} as const satisfies Record<ActivityLevel, string>;

export const HOURS_AWAY_LABELS = {
  "0_to_2": "0–2",
  "3_to_5": "3–5",
  "6_to_8": "6–8",
  "9_plus": "9+",
} as const satisfies Record<HoursAway, string>;

export const PET_EXPERIENCE_LABELS = {
  first_time: "First-time",
  some: "Some",
  experienced: "Experienced",
} as const satisfies Record<PetExperience, string>;

export const SPECIAL_NEEDS_WILLINGNESS_LABELS = {
  yes: "Yes",
  minor_needs_only: "Minor needs only",
  no: "No",
} as const satisfies Record<SpecialNeedsWillingness, string>;

export const HOUSEHOLD_MEMBER_LABELS = {
  just_me: "Just me",
  partner: "Partner",
  kids_under_6: "Kids under 6",
  kids_6_to_12: "Kids 6–12",
  teens: "Teens",
  seniors: "Seniors",
} as const satisfies Record<HouseholdMember, string>;

export const OTHER_PET_LABELS = {
  dogs: "Dog(s)",
  cats: "Cat(s)",
  other: "Other",
} as const satisfies Record<OtherPet, string>;

export const AGE_GROUP_LABELS = {
  puppy_kitten: "Puppy/Kitten",
  adult: "Adult",
  senior: "Senior",
} as const satisfies Record<AgeGroup, string>;

/** The picked labels in the order the options are listed, whatever order the API sent them in. */
function pick<V extends string>(values: readonly V[], labels: Record<V, string>): string[] {
  return (Object.keys(labels) as V[]).filter((value) => values.includes(value)).map((value) => labels[value]);
}

const lower = (label: string) => label.charAt(0).toLowerCase() + label.slice(1);

/** "Partner, kids 6–12": a list that reads as one phrase, so only the first word keeps its capital. */
function phrase(labels: string[]): string {
  return labels.map((label, index) => (index === 0 ? label : lower(label))).join(", ");
}

/** "Dog or cat", "Small, medium or large". */
function anyOf(labels: string[]): string {
  if (labels.length < 2) return labels[0] ?? "";
  return `${phrase(labels.slice(0, -1))} or ${lower(labels[labels.length - 1])}`;
}

/** Who lives in the home, e.g. "Partner, kids 6–12"; null until the quiz says. */
export function householdSummary(home: Pick<HomeProfile, "household_members">): string | null {
  const labels = pick(home.household_members, HOUSEHOLD_MEMBER_LABELS);
  return labels.length ? phrase(labels) : null;
}

/** The other pets at home; no answer is "None" (PR-14). */
export function otherPetsSummary(home: Pick<HomeProfile, "other_pets">): string {
  const labels = pick(home.other_pets, OTHER_PET_LABELS);
  return labels.length ? phrase(labels) : "None";
}

/** "Dog or cat · medium · adult"; a size or age left open reads "any size", "any age". Null until a species is picked. */
export function preferredPetSummary(home: Pick<HomeProfile, "accepted_species" | "preferred_sizes" | "preferred_ages">): string | null {
  const species = pick(home.accepted_species, SPECIES_LABELS);
  if (!species.length) return null;
  const sizes = pick(home.preferred_sizes, PET_SIZE_LABELS);
  const ages = pick(home.preferred_ages, AGE_GROUP_LABELS);
  return [anyOf(species), sizes.length ? anyOf(sizes).toLowerCase() : "any size", ages.length ? anyOf(ages).toLowerCase() : "any age"].join(" · ");
}

/** "3–5 hours a day". */
export function hoursAwaySummary(hours: HoursAway): string {
  return `${HOURS_AWAY_LABELS[hours]} hours a day`;
}
