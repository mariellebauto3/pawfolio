// Verification values exactly as the API sends them, mirroring the enum columns of `verification_submissions` and
// `verification_documents` (backend migration 2026_09_30_000002); keep them in sync. Display names live in
// src/constants/verification.ts.

/** The kinds of valid ID a human can submit (AU-16). */
export const ID_TYPES = ["drivers_license", "passport", "umid", "national_id_philsys", "postal_id"] as const;
export type IdType = (typeof ID_TYPES)[number];

/** Why an admin denied a submission (AU-25). The owner sees it on the Denied screen (AU-20). */
export const DENIAL_REASONS = ["id_photo_unreadable", "name_mismatch", "id_expired", "under_18", "other"] as const;
export type DenialReason = (typeof DENIAL_REASONS)[number];

/** The kinds of file a submission carries. */
export const VERIFICATION_DOCUMENT_TYPES = ["valid_id", "pet_photo", "vet_record_or_certificate"] as const;
export type VerificationDocumentType = (typeof VERIFICATION_DOCUMENT_TYPES)[number];
