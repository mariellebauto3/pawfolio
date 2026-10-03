import type { IsoDate, IsoDateTime } from "@/types/api";
import type { Species } from "@/types/pet";
import type { AccountStatus } from "@/types/statuses";
import type { DenialReason, IdType, VerificationDocumentType } from "@/types/verification";

// What the account-status and submission endpoints answer (docs/api/auth.md, AU-18…AU-21). These are the owner's
// own details: keep them in memory only, never in browser storage or the URL (SEC-FE-04).

/**
 * A file the owner sent for verification. The file itself is admin-only (SEC-PRIV-01), so the owner gets what it is,
 * never a link to it.
 */
export type SubmittedDocument = {
  document_type: VerificationDocumentType;
  /** Set on a human's valid ID (AU-16); null otherwise. */
  id_type: IdType | null;
  mime_type: string;
  size_bytes: number;
  uploaded_at: IsoDateTime;
};

/** `GET /account-status`: why the account isn't Active, and what was last sent for review. */
export type AccountStatusInfo = {
  status: AccountStatus;
  /** Set while Denied: the reason the admin chose (AU-25). */
  denial_reason: DenialReason | null;
  /** The admin's words: the message to the owner (Denied) or the suspension reason (Suspended). Show as plain text. */
  reason: string | null;
  /** When the details were last sent for review; null for accounts that never signed up (admins). */
  submitted_at: IsoDateTime | null;
  /** True once the owner has sent their details again after a denial or an edit. */
  is_resubmission: boolean;
  documents: SubmittedDocument[];
};

type SubmissionBase = { documents: SubmittedDocument[] };

export type PetSubmission = SubmissionBase & {
  role: "pet";
  name: string;
  species: Species;
  breed: string;
  approximate_age_months: number;
  currently_at: string;
  city: string;
  province: string;
  caretaker_name: string;
  caretaker_contact_number: string;
};

export type HumanSubmission = SubmissionBase & {
  role: "human";
  full_name: string;
  birthdate: IsoDate;
  contact_number: string;
  city: string;
  province: string;
  street_address: string;
};

/** `GET /account/submission`: the details a Pending or Denied owner may edit (AU-19). */
export type Submission = PetSubmission | HumanSubmission;
