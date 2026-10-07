import type { RequestStatus } from "@/types/statuses";

// The request rules of proposal §5.3 that screens need to choose what to show. The API enforces every one of them;
// these only keep the UI from offering an action it would refuse (SEC-FE-05).

/** A pet can have this many open requests at a time (RQ-05). */
export const MAX_OPEN_REQUESTS = 3;

/** Days a pet waits before applying to the same home again after Declined or Not Adopted (RQ-06). */
export const REQUEST_COOLDOWN_DAYS = 30;

/** A request that is still moving: it counts toward the limit and stands in for "Apply" on the home (DS-07). */
export const OPEN_REQUEST_STATUSES: readonly RequestStatus[] = ["sent", "on_hold", "approved", "meet_scheduled", "awaiting_decision"];

/** The two endings that start the cooldown. */
export const COOLDOWN_REQUEST_STATUSES: readonly RequestStatus[] = ["declined", "not_adopted"];
