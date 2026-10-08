import { philippineTimeToIso, philippineToday } from "@/lib/utils/format-date";
import type { AdoptionRequest } from "@/types/adoption-request";
import type { MeetAndGreetStatus, MeetContacts, MeetEndReason, MeetGreetSlot } from "@/types/meet-and-greet";

// Made-up Meet & Greet slots and bookings (SEC-PRIV-06), as in the LoFi: Ana Santos offers four slots, and Mochi's
// Meet & Greet with her is confirmed on the first. The numbers and the address are invented.

const DAY_MS = 24 * 60 * 60 * 1000;

/** A time on the Philippine clock some days from today, so the slots are always still ahead. */
const ahead = (days: number, clock: string) => philippineTimeToIso(philippineToday(new Date(Date.now() + days * DAY_MS)), clock) as string;

export type MockSlot = MeetGreetSlot & { deleted: boolean };

export type MockBooking = {
  id: number;
  adoption_request_id: number;
  slot_id: number;
  status: MeetAndGreetStatus;
  booked_at: string;
  confirmed_at: string | null;
  ended_at: string | null;
  ended_by: "pet" | "human" | null;
  end_reason: MeetEndReason | null;
  end_details: string | null;
  proposed_slot_id: number | null;
};

export const MEET_GREET_SLOTS: MockSlot[] = [
  { id: 1, home_profile_id: 1, starts_at: ahead(3, "10:00"), place_type: "shelter", place_details: "Happy Paws Rescue, Quezon City", deleted: false },
  { id: 2, home_profile_id: 1, starts_at: ahead(3, "14:00"), place_type: "public_spot", place_details: "UP Diliman Academic Oval", deleted: false },
  { id: 3, home_profile_id: 1, starts_at: ahead(4, "09:00"), place_type: "caretaker_location", place_details: null, deleted: false },
  { id: 4, home_profile_id: 1, starts_at: ahead(7, "17:30"), place_type: "public_spot", place_details: "UP Diliman Academic Oval", deleted: false },
];

export const MEET_AND_GREETS: MockBooking[] = [
  {
    id: 1,
    adoption_request_id: 1,
    slot_id: 1,
    status: "confirmed",
    booked_at: "2026-09-23T03:00:00.000000Z",
    confirmed_at: "2026-09-23T14:00:00.000000Z",
    ended_at: null,
    ended_by: null,
    end_reason: null,
    end_details: null,
    proposed_slot_id: null,
  },
];

/** A pet's caretaker, by pet id; any other pet has the fallback. */
const CARETAKERS: Record<number, { name: string; number: string }> = {
  1: { name: "Liza Reyes", number: "0917 555 0142" },
};

/** A human's number and exact address, by Home Profile id. */
const HOMES: Record<number, { number: string; street: string; province: string }> = {
  1: { number: "0918 555 0117", street: "12 Sample St., Brgy. Example", province: "Metro Manila" },
};

const isActive = (booking: MockBooking) => booking.status !== "ended";

const slotOf = (slotId: number | null): MeetGreetSlot | null => {
  const found = MEET_GREET_SLOTS.find((slot) => slot.id === slotId);
  if (!found) return null;
  const { id, home_profile_id, starts_at, place_type, place_details } = found;
  return { id, home_profile_id, starts_at, place_type, place_details };
};

/** The booking of a request that is booked or confirmed now. */
export function activeBooking(requestId: number): MockBooking | null {
  return MEET_AND_GREETS.findLast((booking) => booking.adoption_request_id === requestId && isActive(booking)) ?? null;
}

/** Whether a slot can be booked: not removed, still ahead, and held by nobody. */
export function isBookable(slot: MockSlot, now = Date.now()): boolean {
  return !slot.deleted && new Date(slot.starts_at).getTime() > now && !MEET_AND_GREETS.some((booking) => booking.slot_id === slot.id && isActive(booking));
}

function formatBooking(booking: MockBooking) {
  const { slot_id, proposed_slot_id, ...rest } = booking;
  return { ...rest, meet_greet_slot_id: slot_id, proposed_slot_id, slot: slotOf(slot_id), proposed_slot: slotOf(proposed_slot_id) };
}

/**
 * What `GET /adoption-requests/{id}` says about the Meet & Greet: the booking that stands, the newest one, the slots
 * that can be taken while the request is Approved or Meet Scheduled, and the contact details only while a meeting is
 * confirmed or its time has passed (SEC-PRIV-02).
 */
export function meetDetails(request: AdoptionRequest) {
  const active = activeBooking(request.id);
  const latest = MEET_AND_GREETS.findLast((booking) => booking.adoption_request_id === request.id) ?? null;
  const unlocked = active?.status === "confirmed" || request.status === "awaiting_decision" || request.status === "adopted";
  const caretaker = CARETAKERS[request.pet.id] ?? { name: "Sam Dizon", number: "0917 555 0100" };
  const home = HOMES[request.home_profile.id] ?? { number: "0918 555 0100", street: "1 Example Ave.", province: "Metro Manila" };

  const contacts: MeetContacts | null = unlocked
    ? {
        caretaker_name: caretaker.name,
        caretaker_contact_number: caretaker.number,
        human_full_name: request.home_profile.full_name,
        human_contact_number: home.number,
        human_street_address: home.street,
        human_city: request.home_profile.city,
        human_province: home.province,
      }
    : null;

  const offersSlots = request.status === "approved" || request.status === "meet_scheduled";
  return {
    meet_and_greet: active || latest ? formatBooking((active ?? latest) as MockBooking) : null,
    active_meet_and_greet: active ? formatBooking(active) : null,
    latest_meet_and_greet: latest ? formatBooking(latest) : null,
    available_slots: offersSlots
      ? MEET_GREET_SLOTS.filter((slot) => slot.home_profile_id === request.home_profile.id && isBookable(slot))
          .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
          .map((slot) => slotOf(slot.id))
      : [],
    contact_unlocked: unlocked,
    contacts,
  };
}
