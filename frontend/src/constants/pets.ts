import type { Species } from "@/types/pet";

// Display names for the API's pet values.

export const SPECIES_LABELS = {
  dog: "Dog",
  cat: "Cat",
  other: "Other",
} as const satisfies Record<Species, string>;
