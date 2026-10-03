import type { IsoDateTime } from "@/types/api";
import type { PetStatus } from "@/types/statuses";

// A pet's public resume, mirroring the `pets` table and its child tables (backend migration
// 2026_09_30_000003). Private fields — caretaker contact number, vet records — are not part of this type: they reach
// the frontend only through the endpoints that are allowed to reveal them (NFR4, SEC-PRIV-01/02).

export type Species = "dog" | "cat" | "other";
export type PetSex = "female" | "male";
export type PetSize = "small" | "medium" | "large";
export type EnergyLevel = "low" | "medium" | "high";
export type GoodWith = "yes" | "no" | "unknown";
export type TimeAlone = "up_to_2_hrs" | "up_to_4_hrs" | "up_to_6_hrs" | "8_plus_hrs";
export type SpaceNeeds = "apartment_ok" | "needs_yard_or_daily_walks" | "ground_floor";
export type ExperienceNeeded = "first_time_ok" | "some_experience" | "experienced_only";
export type PetSkill =
  | "sit_and_stay"
  | "leash_trained"
  | "potty_trained"
  | "crate_trained"
  | "litter_trained"
  | "comes_when_called"
  | "learning_sit"
  | "potty_training_in_progress"
  | "scratching_post_only"
  | "quiet_at_night"
  | "house_trained"
  | "sit"
  | "shake";
export type PetSpecialNeed = "daily_meds" | "special_diet" | "mobility_support";

export type PetPhoto = {
  id: number;
  url: string;
  caption: string | null;
};

export type Pet = {
  id: number;
  name: string;
  species: Species;
  breed: string;
  approximate_age_months: number;
  sex: PetSex | null;
  size: PetSize | null;
  currently_at: string;
  city: string;
  province: string;
  /** First person, 50–600 characters (PR-05). */
  bio: string | null;
  energy_level: EnergyLevel | null;
  good_with_kids: GoodWith | null;
  good_with_dogs: GoodWith | null;
  good_with_cats: GoodWith | null;
  time_alone: TimeAlone | null;
  space_needs: SpaceNeeds | null;
  experience_needed: ExperienceNeeded | null;
  health_notes: string | null;
  /** Up to 5 (PR-05). */
  temperament_tags: string[];
  skills: PetSkill[];
  /** Empty means None (PR-07). */
  special_needs: PetSpecialNeed[];
  cover_photo_url: string | null;
  /** Ordered; the first is the profile photo (PR-04). */
  photos: PetPhoto[];
  status: PetStatus;
  published_at: IsoDateTime | null;
};

/** The few fields other resources embed when they point at a pet (cards, request lists). */
export type PetSummary = Pick<Pet, "id" | "name" | "species" | "breed" | "city" | "status"> & {
  photo_url: string | null;
};
