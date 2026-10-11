import type { ResolutionAction } from "@/types/adoption-resolution";

// The four actions of Resolve adoption issue in the words of the screens (AL-07), wherever one is named: the form,
// its confirmation, the list of recent resolutions and a request's timeline.

/** The action as the form offers it. */
export const RESOLUTION_ACTION_LABELS = {
  cancel_adoption: "Cancel adoption",
  return_to_looking_for_a_home: "Return pet to Looking for a Home",
  close_request: "Close request",
  reopen_meet_greet_booking: "Reopen Meet & Greet booking",
} as const satisfies Record<ResolutionAction, string>;

/** The action as something that happened: "admin.jess cancelled the adoption". */
export const RESOLUTION_ACTION_DONE = {
  cancel_adoption: "cancelled the adoption",
  return_to_looking_for_a_home: "returned the pet to Looking for a Home",
  close_request: "closed the request",
  reopen_meet_greet_booking: "reopened Meet & Greet booking",
} as const satisfies Record<ResolutionAction, string>;
