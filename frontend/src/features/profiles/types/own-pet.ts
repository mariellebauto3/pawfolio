import type { IsoDateTime } from "@/types/api";
import type { Pet } from "@/types/pet";

// What `GET /me/pet` and the other resume endpoints answer (docs/api/profiles-and-matching.md, PR-01…PR-10): the
// pet's own resume with what only the owner sees.

/** The five things a resume needs before it can be published, by wizard step. */
export const RESUME_REQUIREMENTS = ["basics", "photos", "about_temperament", "compatibility", "health"] as const;
export type ResumeRequirement = (typeof RESUME_REQUIREMENTS)[number];

export type ResumeCompleteness = {
  is_complete: boolean;
  /** Share of the requirements that are met, 0 to 100 (profile strength, PR-01). */
  strength_percent: number;
  steps: Record<ResumeRequirement, boolean>;
  /** One sentence for each requirement that isn't met (Draft banner, PR-02). */
  missing: string[];
};

/** A private vet record: described, never linked. A human sees it only on an approved request (PR-07). */
export type VetRecord = {
  id: number;
  mime_type: string;
  size_bytes: number;
  uploaded_at: IsoDateTime;
};

export type OwnPet = Pet & {
  caretaker_name: string;
  vet_records: VetRecord[];
  completeness: ResumeCompleteness;
};

/** One of the pet's own posts, as the Latest activity card shows it (PR-01). */
export type ActivityPost = {
  id: number;
  text: string;
  created_at: IsoDateTime;
};
