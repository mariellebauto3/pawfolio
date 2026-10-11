import type { IsoDateTime } from "@/types/api";
import type { HomeProfile } from "@/types/home-profile";

// What the Invite to Apply endpoints answer (docs/api/bookmarks-and-invites.md, RQ-01, RQ-02).

/** An invite as the pet that received it reads it (RQ-02). */
export type Invite = {
  id: number;
  /** The human's personal note. Typed by a user: rendered as plain text (SEC-FE-01). */
  note: string | null;
  created_at: IsoDateTime | null;
  /** The pet's open request with this home, when it has applied already. */
  open_request_id: number | null;
  /** When the pet may apply to this home again after a Declined or Not Adopted result; null when it may now. */
  cooldown_until: IsoDateTime | null;
  /** The home that invited, public details only (SEC-PRIV-03), with the pet's match when there is one. */
  home_profile: HomeProfile & { match_score?: number; is_bookmarked?: boolean };
};

/** The invite a human just sent (RQ-01). */
export type SentInvite = {
  id: number;
  pet_id: number;
  home_profile_id: number;
  note: string | null;
  created_at: IsoDateTime | null;
};
