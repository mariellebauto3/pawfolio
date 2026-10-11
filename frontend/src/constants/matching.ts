import type { Dealbreaker } from "@/types/match";

// How the match rules are worded on screen (proposal §6, MT-03). The pet and the human read the same score, so
// every label names "the home" and "the pet" and fits either reader.

/** A dealbreaker that passed, as a short check: "Species accepted". */
export const DEALBREAKER_PASSED_LABELS = {
  species_accepted: "Species accepted",
  ok_with_kids: "OK with kids at home",
  ok_with_other_pets: "OK with pets at home",
  same_province: "Same province",
} as const satisfies Record<Dealbreaker, string>;

/** A dealbreaker that failed, said plainly instead of showing a score of 0. */
export const DEALBREAKER_FAILED_LABELS = {
  species_accepted: "The home doesn’t accept this species",
  ok_with_kids: "Not suited to a home with young kids",
  ok_with_other_pets: "Not suited to the other pets at home",
  same_province: "In a different province",
} as const satisfies Record<Dealbreaker, string>;

/**
 * The seven weighted criteria by the API's key: what the home answered, then what the pet's resume says. A key
 * that isn't here (a criterion added later) falls back to the API's own label.
 */
export const CRITERION_LABELS: Record<string, string> = {
  activity: "Activity level and energy level",
  hours_away: "Hours away and time left alone",
  space: "Home, outdoor space and space needs",
  experience: "Pet experience and experience needed",
  size_age: "Preferred size and age",
  compatibility: "Kids, other pets and who the pet is good with",
  special_needs: "Special needs and the care the home offers",
};
