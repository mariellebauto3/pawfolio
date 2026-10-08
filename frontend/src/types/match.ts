// The parts of a match that more than one module reads (proposal §6): Discovery shows them beside a profile,
// Matching explains them in the breakdown (MT-03).

/** The four checks made before any score is worked out. A pair that fails one is not a match. */
export const DEALBREAKERS = ["species_accepted", "ok_with_kids", "ok_with_other_pets", "same_province"] as const;
export type Dealbreaker = (typeof DEALBREAKERS)[number];
