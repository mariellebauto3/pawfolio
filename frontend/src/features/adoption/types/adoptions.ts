import type { IsoDateTime } from "@/types/api";
import type { HomeProfileSummary } from "@/types/home-profile";
import type { MeetGreetSlot } from "@/types/meet-and-greet";
import type { PetSummary } from "@/types/pet";

// What the adoption endpoints answer (docs/api/adoption-and-meet-greet.md, "The decision and the adoption"). An
// adoption is made only by the Adopt action (AL-01); nothing here is ever sent (FR27).

/** The adoption an Adopted request ended in, as `GET /adoption-requests/{id}` names it (AL-04). */
export type RequestAdoption = {
  id: number;
  adopted_at: IsoDateTime | null;
};

/**
 * One adoption as `GET /adoptions/{id}` sends it (AL-06): the pet and its Furparent, the milestones of the request
 * behind it, where the two met, and the pet's cover letter. Read only by the pet, the Furparent and admins
 * (SEC-AUTHZ-03). It never carries an address or a phone number (SEC-PRIV-02).
 */
export type AdoptionRecord = {
  id: number;
  pet: PetSummary;
  home_profile: HomeProfileSummary;
  /** The Adopted request, kept as the record of this adoption (AL-04). */
  adoption_request_id: number;
  adopted_at: IsoDateTime | null;
  /** Whole days from the day the request was sent to the adoption; at least 1. Null when the API can't say. */
  days_to_adoption: number | null;
  cover_letter: string | null;
  timeline: {
    sent_at: IsoDateTime | null;
    approved_at: IsoDateTime | null;
    meet_scheduled_at: IsoDateTime | null;
  };
  /** When and where the two met: a slot's time and place, never anyone's home address. */
  meeting: Pick<MeetGreetSlot, "starts_at" | "place_type" | "place_details"> | null;
};

/** The two sides of an adoption as the dialogs name and picture them. */
export type AdoptionPair = {
  pet: { id: number; name: string; photoUrl: string | null };
  home: { name: string; photoUrl: string | null };
};
