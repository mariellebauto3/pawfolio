// Verification values exactly as the API sends them, mirroring the enum columns of `verification_documents`
// (backend migration 2026_09_30_000002); keep them in sync. Display names live in src/constants/verification.ts.

/** The kinds of valid ID a human can submit (AU-16). */
export const ID_TYPES = ["drivers_license", "passport", "umid", "national_id_philsys", "postal_id"] as const;
export type IdType = (typeof ID_TYPES)[number];
