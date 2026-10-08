// Made-up matches for mock mode. The real scores come from the matching rules on the server (proposal §6); these
// only give the screens something to rank and explain.

/** A score for each pet and home that pass the dealbreakers, keyed "petId:homeProfileId". A pair that isn't here fails one. */
export const MATCH_SCORES: Record<string, number> = { "1:1": 86, "1:3": 78, "3:1": 72, "5:1": 64, "6:1": 91 };

/** Worded as the API words them: for both readers, so nobody is "you". */
export const MATCH_REASONS = [
  "The home’s activity level fits the pet’s energy",
  "The pet is fine alone for the hours the home is empty",
  "The home has the experience the pet needs",
];

const CRITERIA = [
  { key: "activity", label: "Activity level ↔ energy level", max_points: 20 },
  { key: "hours_away", label: "Hours away ↔ time it can be left alone", max_points: 15 },
  { key: "space", label: "Home type & outdoor space ↔ space needs", max_points: 15 },
  { key: "experience", label: "Pet experience ↔ experience it needs", max_points: 15 },
  { key: "size_age", label: "Preferred size & age ↔ size & age", max_points: 15 },
  { key: "compatibility", label: "Kids & other pets ↔ compatibility tags", max_points: 10 },
  { key: "special_needs", label: "Special needs ↔ medical care", max_points: 10 },
] as const;

/** The seven criteria with points that add up to `score`: each takes its share, and the first takes the rounding. */
export function criteriaFor(score: number) {
  const points = CRITERIA.map(({ max_points }) => Math.round((max_points * score) / 100));
  points[0] += score - points.reduce((sum, value) => sum + value, 0);
  return CRITERIA.map((criterion, index) => ({ ...criterion, points: Math.min(criterion.max_points, Math.max(points[index], 0)) }));
}
