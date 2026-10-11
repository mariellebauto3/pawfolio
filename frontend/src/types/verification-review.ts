import type { HumanSubmission, PetSubmission, SubmittedDocument } from "@/types/account-status";
import type { IsoDateTime } from "@/types/api";
import type { AccountStatus, VerificationStatus } from "@/types/statuses";
import type { DenialReason } from "@/types/verification";

// What the admin verification endpoints answer (docs/api/auth.md, AU-22…AU-26, FR33). Admins only: these carry
// contact numbers and point at ID documents, so keep them in memory, never in browser storage or the URL
// (SEC-FE-04).

/** The account types an admin verifies. Admin accounts are never in the queue (SEC-AUTH-10). */
export type VerifiedRole = "pet" | "human";

/** One account waiting for review: a row of `GET /admin/verifications` (AU-22). */
export type VerificationQueueItem = {
  account_id: number;
  role: VerifiedRole;
  /** The pet's name or the human's full name. */
  display_name: string;
  /** Pets only: who signed the pet up. */
  caretaker_name: string | null;
  submitted_at: IsoDateTime;
  /** True when the details were sent again after a denial or an edit. */
  is_resubmission: boolean;
  documents: SubmittedDocument[];
};

/** A submitted file the admin can open through `GET /admin/verifications/{accountId}/documents/{id}`. */
export type ReviewDocument = SubmittedDocument & { id: number };

export type PetReviewDetails = Omit<PetSubmission, "documents">;

/** A human's street address isn't sent: the review compares the name, the age and the ID (SEC-PRIV-04). */
export type HumanReviewDetails = Omit<HumanSubmission, "documents" | "street_address">;

/** The denial of the round before this one, shown on a resubmission (AU-24). */
export type PreviousDenial = {
  denial_reason: DenialReason;
  message_to_owner: string | null;
  reviewed_at: IsoDateTime;
};

/** Where the account stands among those still waiting, oldest first. */
export type QueuePosition = {
  /** 1 for the oldest; null once this account has been decided. */
  position: number | null;
  /** How many accounts are waiting now. */
  total: number;
  /** The next account to review after this one; null when no other is waiting. */
  next_account_id: number | null;
};

/** `GET /admin/verifications/{accountId}`: the account's latest submission, to review or to look back on. */
export type VerificationReview = {
  account_id: number;
  display_name: string;
  account_status: AccountStatus;
  /** Of this submission. Only a `pending` one can be approved or denied. */
  status: VerificationStatus;
  submitted_at: IsoDateTime;
  is_resubmission: boolean;
  previous_denial: PreviousDenial | null;
  /** Set once decided: when, by which admin, and for a denial the reason and the message the owner sees (AU-20). */
  reviewed_at: IsoDateTime | null;
  reviewed_by: string | null;
  denial_reason: DenialReason | null;
  message_to_owner: string | null;
  details: PetReviewDetails | HumanReviewDetails;
  documents: ReviewDocument[];
  queue: QueuePosition;
};

/** The body of `POST /admin/verifications/{accountId}/deny` (AU-25). */
export type DenialInput = {
  denial_reason: DenialReason;
  /** Required when the reason is `other`. */
  message_to_owner: string | null;
};
