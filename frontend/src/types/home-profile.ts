import type { Species, PetSize } from "@/types/pet";

// A human's public Home Profile, mirroring the `home_profiles` table and its quiz answer tables (backend migration
// 2026_09_30_000004). Public profiles show the city and a household summary only (SEC-PRIV-03): birthdate, contact
// number, street address and province are not part of this type.

export type HomeType = "house" | "condo" | "apartment" | "townhouse";
export type OutdoorSpace = "none" | "balcony" | "small_yard" | "large_yard";
export type ActivityLevel = "relaxed" | "moderate" | "active" | "very_active";
export type HoursAway = "0_to_2" | "3_to_5" | "6_to_8" | "9_plus";
export type PetExperience = "first_time" | "some" | "experienced";
export type SpecialNeedsWillingness = "yes" | "minor_needs_only" | "no";
export type HouseholdMember = "just_me" | "partner" | "kids_under_6" | "kids_6_to_12" | "teens" | "seniors";
export type OtherPet = "dogs" | "cats" | "other";
export type AgeGroup = "puppy_kitten" | "adult" | "senior";

export type HomeProfile = {
  id: number;
  full_name: string;
  city: string;
  headline: string | null;
  about_home: string | null;
  profile_photo_url: string | null;
  cover_photo_url: string | null;
  // Lifestyle quiz answers (PR-14…PR-18); null until the quiz is saved.
  home_type: HomeType | null;
  outdoor_space: OutdoorSpace | null;
  activity_level: ActivityLevel | null;
  hours_away: HoursAway | null;
  pet_experience: PetExperience | null;
  special_needs_willingness: SpecialNeedsWillingness | null;
  household_members: HouseholdMember[];
  /** Empty means None (PR-14). */
  other_pets: OtherPet[];
  accepted_species: Species[];
  preferred_sizes: PetSize[];
  preferred_ages: AgeGroup[];
  /** Open to Adopt toggle (FR4). */
  is_open_to_adopt: boolean;
  /** Furparent label (FR13); stays after an adoption link is removed. */
  is_furparent: boolean;
  /** Pets for You unlocks once the quiz is done (MT-04). */
  has_completed_quiz: boolean;
};

/** The few fields other resources embed when they point at a Home Profile (cards, request lists). */
export type HomeProfileSummary = Pick<HomeProfile, "id" | "full_name" | "city" | "profile_photo_url" | "is_furparent">;
