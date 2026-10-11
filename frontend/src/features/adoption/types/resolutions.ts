import type { ResolutionAction } from "@/types/adoption-resolution";
import type { IsoDateTime } from "@/types/api";
import type { PetStatus, RequestStatus } from "@/types/statuses";

// What Resolve adoption issue reads and sends (docs/api/adoption-and-meet-greet.md, "Resolve adoption issue",
// AL-07, AL-08, FR37). The screen sends an action, the request it is about and a reason; it never sends a status
// (FR27). Which action applies to what is the API's to say.

/** The pet an issue is resolved for. */
export type ResolvePet = {
  id: number;
  name: string;
  status: PetStatus;
  city: string | null;
  photo_url: string | null;
  /** The pet's account, for the link to its page (AC-07). */
  user_id: number | null;
};

/** The pet's Furparent link while it stands. */
export type ResolveFurparent = {
  home_profile_id: number;
  full_name: string | null;
  adopted_at: IsoDateTime | null;
  adoption_request_id: number | null;
};

/** One of the pet's requests, as the "Related request" list names it. */
export type ResolveRequest = {
  id: number;
  status: RequestStatus;
  home_name: string | null;
  sent_at: IsoDateTime | null;
  closed_at: IsoDateTime | null;
};

/** One of the four actions, as the pet stands now. */
export type ResolveActionOption = {
  action: ResolutionAction;
  available: boolean;
  /** The requests it can be applied to. Empty while `available` means it changes the pet alone. */
  request_ids: number[];
  /** Why it isn't available, in the API's words. */
  unavailable_reason: string | null;
};

export type ResolveOptions = {
  pet: ResolvePet;
  furparent: ResolveFurparent | null;
  /** Newest first. */
  requests: ResolveRequest[];
  /** All four, in the order the screen lists them. */
  actions: ResolveActionOption[];
};

type Standing = { pet_status: PetStatus; request_status: RequestStatus | null; furparent_name: string | null };

/** What an action would change, or did change (AL-08). */
export type ResolutionChange = {
  pet_name: string;
  action: ResolutionAction;
  request: { id: number; home_name: string | null } | null;
  before: Standing;
  after: Standing;
  /** How many of the pet's requests On Hold go back to Sent. */
  requests_restored: number;
  /** Whether a Meet & Greet that is still booked ends with it. */
  meeting_ended: boolean;
};

/** What the form sends. */
export type ResolutionInput = { action: ResolutionAction; requestId: number | null };

/** A pet found by name, to resolve an issue for. */
export type PetMatch = {
  id: number;
  name: string;
  status: PetStatus | null;
  city: string | null;
  photo_url: string | null;
  caretaker_name: string | null;
};
