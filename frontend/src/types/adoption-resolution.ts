import type { IsoDateTime } from "@/types/api";

// An admin's manual change through Resolve adoption issue, mirroring `adoption_resolutions` (backend migration
// 2026_09_30_000006) as the API sends it (docs/api/adoption-and-meet-greet.md). It is the only way a pet's or a
// request's status changes outside the normal flow (FR27, FR37), and it is an action with a reason, never a status
// that is sent.

export const RESOLUTION_ACTIONS = ["cancel_adoption", "return_to_looking_for_a_home", "close_request", "reopen_meet_greet_booking"] as const;
export type ResolutionAction = (typeof RESOLUTION_ACTIONS)[number];

/** One resolution as the lists and a request's timeline read it: what was done, to whom, by which admin and why (NFR9). */
export type Resolution = {
  id: number;
  action: ResolutionAction;
  /** The admin's own words. Rendered as text (SEC-FE-01). */
  reason: string;
  pet: { id: number; name: string } | null;
  /** The request it acted on; null when it changed the pet alone. */
  adoption_request_id: number | null;
  /** The home on that request. */
  home_name: string | null;
  /** Null when the admin's account is gone. */
  admin_name: string | null;
  created_at: IsoDateTime;
};
