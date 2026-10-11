import type { MeetAndGreet, MeetContacts, MeetGreetSlot } from "@/types/meet-and-greet";
import type { RequestStatus } from "@/types/statuses";

// What the Meet & Greet screens read beyond the shared types (docs/api/adoption-and-meet-greet.md).

/**
 * The Meet & Greet part of `GET /adoption-requests/{id}`, read beside the request itself (MG-03…MG-14): the booking
 * that stands, the last one whatever became of it, the slots that can still be taken, whether its time has passed,
 * and the contact details a confirmed meeting opens (SEC-PRIV-02).
 */
export type RequestMeeting = {
  /** The booking that is booked or confirmed now; null when booking is open. */
  active: MeetAndGreet | null;
  /** The newest booking, ended or not: it says why booking reopened (a proposal, a cancellation). */
  latest: MeetAndGreet | null;
  /** The home's slots that are still ahead and held by nobody, soonest first. */
  slots: MeetGreetSlot[];
  /**
   * The confirmed meeting's time is behind us, so the human's decision is open (MG-11, MG-12). The API says so; no
   * screen compares clocks, and it is true before the request's status reads Awaiting Decision as well.
   */
  passed: boolean;
  /** Null until a Meet & Greet is confirmed, and again once it is moved, cancelled or declined afterwards. */
  contacts: MeetContacts | null;
};

/** A slot on the human's availability page (MG-01), with the pet that booked it. */
export type UpcomingSlot = MeetGreetSlot & {
  booking: {
    /** Booked: waiting for the human to confirm. Confirmed: the meeting is scheduled. */
    status: "booked" | "confirmed";
    adoption_request_id: number;
    pet_name: string;
  } | null;
};

/** A confirmed meeting whose time has come (MG-01, "Past Meet & Greets"), with where its request stands now. */
export type PastMeeting = {
  id: number;
  adoption_request_id: number;
  pet_name: string;
  request_status: RequestStatus;
  /** The human reported that it didn't take place (MG-13). */
  didnt_happen: boolean;
  slot: MeetGreetSlot;
};

/** What `POST /meet-greet-slots` takes (MG-02). */
export type NewSlot = {
  starts_at: string;
  place_type: MeetGreetSlot["place_type"];
  place_details: string | null;
  /** 1 for a single slot, up to 4 for the same slot on the weeks that follow. */
  repeat_weeks: number;
};
