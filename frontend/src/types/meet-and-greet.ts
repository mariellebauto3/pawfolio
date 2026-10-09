import type { IsoDateTime } from "@/types/api";

// A Meet & Greet between the two sides of an approved request, mirroring `meet_greet_slots` and `meet_and_greets`
// (backend migration 2026_09_30_000006) as the API sends them (docs/api/adoption-and-meet-greet.md). A booking's
// status changes only through the action endpoints (book, confirm, reschedule, cancel), never by sending `status`
// (FR27).

/** Where a slot takes place (MG-02). */
export type PlaceType = "public_spot" | "shelter" | "caretaker_location";

/** A time and place a human offers for a Meet & Greet (FR11). */
export type MeetGreetSlot = {
  id: number;
  home_profile_id: number;
  starts_at: IsoDateTime;
  place_type: PlaceType;
  /** The name of the park or the shelter. Null for a meeting at the caretaker's, which is the pet's side to place. */
  place_details: string | null;
};

/** Booked by the pet, confirmed by the human, ended when it is moved, cancelled or its time has come (§5.4). */
export type MeetAndGreetStatus = "booked" | "confirmed" | "ended";

/** Why a meeting was called off before it happened (MG-10). */
export type CancelReason = "schedule_conflict" | "pet_unwell" | "weather_or_travel" | "other";

/** What happened to a meeting whose time came without the two sides meeting, as the human reports it (MG-13). */
export type DidntHappenReason = "didnt_show_pet_side" | "didnt_show_human_side" | "moved_to_another_day" | "other";

/** Why a booking ended: called off (MG-10), moved to another slot (MG-06, MG-09), or what happened instead (MG-13). */
export type MeetEndReason = CancelReason | DidntHappenReason;

/** One booking of a slot for a request. A request has several over its life; at most one is booked or confirmed. */
export type MeetAndGreet = {
  id: number;
  status: MeetAndGreetStatus;
  booked_at: IsoDateTime | null;
  confirmed_at: IsoDateTime | null;
  ended_at: IsoDateTime | null;
  /** Which side ended it; null when its time simply came, or while it hasn't ended. */
  ended_by: "pet" | "human" | null;
  end_reason: MeetEndReason | null;
  /** The details of a cancellation, the reason of a reschedule, or the message with a proposal. */
  end_details: string | null;
  slot: MeetGreetSlot | null;
  /** The slot it moved to (MG-09), or the one the human offered instead (MG-06). */
  proposed_slot: MeetGreetSlot | null;
};

/**
 * What each side learns about the other once a Meet & Greet is confirmed, and never before (SEC-PRIV-02, NFR4).
 * Shown on the request while the meeting stands; never kept in browser storage or put in a URL (SEC-FE-04).
 */
export type MeetContacts = {
  caretaker_name: string | null;
  caretaker_contact_number: string | null;
  human_full_name: string | null;
  human_contact_number: string | null;
  human_street_address: string | null;
  human_city: string | null;
  human_province: string | null;
};
