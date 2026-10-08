import type { IsoDateTime } from "@/types/api";
import type { HomeProfile, HomeProfileSummary } from "@/types/home-profile";
import type { PetSummary } from "@/types/pet";
import type { RequestStatus } from "@/types/statuses";

// An adoption request from a pet to a human, mirroring `adoption_requests` (backend migration 2026_09_30_000006).
// Visible only to the pet, the human on the request and admins (SEC-AUTHZ-03). Status changes only through the
// action endpoints (approve, decline, withdraw…), never by sending `status` (FR27).

export type DeclineReason = "not_right_fit" | "not_adopting_now" | "another_pet_joining" | "other";
export type WithdrawReason = "found_better_match" | "caretaker_cant_make_schedule" | "pet_no_longer_available" | "other";

/**
 * The home as a request names it: the summary, and the two public facts a row of My requests shows beside the city
 * (RQ-07). Never the address or the phone number (SEC-PRIV-03).
 */
export type RequestHome = HomeProfileSummary & Pick<HomeProfile, "home_type" | "household_members">;

/** The pet as a request names it: the summary, and the age a row of the inbox shows beside the breed (RQ-09). */
export type RequestPet = PetSummary & { approximate_age_months: number | null };

export type AdoptionRequest = {
  id: number;
  status: RequestStatus;
  /** The sender (FR24). */
  pet: RequestPet;
  /** The recipient. */
  home_profile: RequestHome;
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
