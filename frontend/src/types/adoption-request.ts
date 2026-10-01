import type { IsoDateTime } from "@/types/api";
import type { HomeProfileSummary } from "@/types/home-profile";
import type { PetSummary } from "@/types/pet";
import type { RequestStatus } from "@/types/statuses";

// An adoption request from a pet to a human, mirroring `adoption_requests` (backend migration 2026_09_30_000006).
// Visible only to the pet, the human on the request and admins (SEC-AUTHZ-03). Status changes only through the
// action endpoints (approve, decline, withdraw…), never by sending `status` (FR27).

export type DeclineReason = "not_right_fit" | "not_adopting_now" | "another_pet_joining" | "other";
export type WithdrawReason = "found_better_match" | "caretaker_cant_make_schedule" | "pet_no_longer_available" | "other";

export type AdoptionRequest = {
  id: number;
  status: RequestStatus;
  /** The sender (FR24). */
  pet: PetSummary;
  /** The recipient. */
  home_profile: HomeProfileSummary;
  /** "Why I'd fit your home", 50–600 characters (RQ-03). */
  cover_letter: string;
  caretaker_notes: string | null;
  approval_message: string | null;
  decline_reason: DeclineReason | null;
  decision_message: string | null;
  withdraw_reason: WithdrawReason | null;
  sent_at: IsoDateTime | null;
  /** Sent + 14 days, or approved + 14 days without a booking (§5.3). */
  expires_at: IsoDateTime | null;
  approved_at: IsoDateTime | null;
  meet_scheduled_at: IsoDateTime | null;
  awaiting_decision_at: IsoDateTime | null;
  closed_at: IsoDateTime | null;
};
