import type { Paginated } from "@/types/api";
import type { HomeProfile } from "@/types/home-profile";
import type { Dealbreaker } from "@/types/match";
import type { Pet } from "@/types/pet";

// What the matches endpoints answer (docs/api/profiles-and-matching.md, "Compatibility Matches"). One score for a
// pet and a home, read the same by both sides (MT-02).

type MatchRow = {
  /** 0 to 100. Every listed pair passed the four dealbreakers. */
  score: number;
  /** Up to three sentences on why they fit, written by the API for both readers. */
  reasons: string[];
};

/** A row of Pets for You (MT-01): a pet's public resume with the human's score for it. */
export type PetMatch = MatchRow & { pet: Pet };

/** A row of Homes for You (MT-02): a Home Profile's public details with the pet's score for it. */
export type HomeMatch = MatchRow & { home_profile: HomeProfile };

/** Why an account has no matches yet: the quiz isn't finished (MT-04), the resume is a Draft (MT-05), or the pet has its home. */
export const INELIGIBLE_REASONS = ["quiz_incomplete", "resume_draft", "already_adopted"] as const;
export type IneligibleReason = (typeof INELIGIBLE_REASONS)[number];

/** `GET /matches`: a page of matches, or why this account has none to show yet. */
export type Matches<T> = { eligible: true; page: Paginated<T> } | { eligible: false; reason: IneligibleReason };

/** One of the seven weighted criteria: the points this pair earned out of the most it can give. */
export type MatchCriterion = {
  key: string;
  /** The API's own name for it, used when the screen has no wording for the key. */
  label: string;
  points: number;
  max_points: number;
};

/** `GET /matches/{profile}/breakdown`: how a score is made up (MT-03). */
export type MatchBreakdown = {
  /** The criteria's points added up; 0 when a dealbreaker failed. */
  score: number;
  passed_dealbreakers: boolean;
  /** Empty when they all passed. */
  failed_dealbreakers: Dealbreaker[];
  /** In the API's order: 20, 15, 15, 15, 15, 10 and 10 points, 100 in all. */
  criteria: MatchCriterion[];
  reasons: string[];
};
