import type { AdoptionRequest } from "@/types/adoption-request";
import type { IsoDateTime, Paginated } from "@/types/api";
import type { RequestStatus } from "@/types/statuses";

// What the adoption request endpoints answer beyond the request itself (docs/api/adoption-and-meet-greet.md).

/** How many of the caller's requests are in each status; a status with none is left out. */
export type RequestStatusCounts = Partial<Record<RequestStatus, number>>;

/** A page of the caller's requests, with the count of every status whatever the tab (RQ-07, RQ-08). */
export type RequestPage = Paginated<AdoptionRequest> & { counts: RequestStatusCounts };

/**
 * One request as `GET /adoption-requests/{id}` sends it, as far as the pet's screens read it (RQ-14, RQ-15,
 * RQ-17). The Meet & Greet and the contact details a confirmed meeting unlocks ride along on the
 * answer; they belong to the Meet & Greet screens and are not part of this type (SEC-PRIV-02).
 */
export type RequestDetail = AdoptionRequest & {
  /** The match between the pet and the home, 0 to 100; null when there is no score. */
  match_score: number | null;
  /** When the pet may apply to this home again after Declined or Not Adopted; null when it may now. */
  cooldown_until: IsoDateTime | null;
};

/** The request a pet just sent (RQ-04), with how many it has open now, this one included. */
export type SentRequest = {
  request: AdoptionRequest;
  /** Null when the answer didn't say; the screen then leaves the count out. */
  openRequests: number | null;
};
