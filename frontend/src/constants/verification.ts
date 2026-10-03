import type { DenialReason, IdType, VerificationDocumentType } from "@/types/verification";

// Display names for the API's verification values, as the LoFi words them (AU-16, AU-18, AU-25).

export const ID_TYPE_LABELS = {
  drivers_license: "Driver's license",
  passport: "Passport",
  umid: "UMID",
  national_id_philsys: "National ID (PhilSys)",
  postal_id: "Postal ID",
} as const satisfies Record<IdType, string>;

export const DENIAL_REASON_LABELS = {
  id_photo_unreadable: "ID photo is blurry or unreadable",
  name_mismatch: "Name doesn't match the ID",
  id_expired: "ID is expired",
  under_18: "Under 18",
  other: "Other",
} as const satisfies Record<DenialReason, string>;

export const VERIFICATION_DOCUMENT_LABELS = {
  valid_id: "Valid ID",
  pet_photo: "Pet photo",
  vet_record_or_certificate: "Vet record",
} as const satisfies Record<VerificationDocumentType, string>;
