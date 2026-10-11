import { slotPlace } from "@/constants/meet-and-greet";
import type { StatusName } from "@/constants/status-badges";
import { formatMeetingTime } from "@/lib/utils/format-date";
import type { IsoDateTime } from "@/types/api";
import type { AdoptionRecord } from "../types/adoptions";

// How an adoption is told on its details dialog (AL-06). Every date is the API's; nothing here decides one (FR27).

/** One line of an adoption's story, for the shared Timeline. */
export type AdoptionEvent = {
  id: string;
  title: string;
  at: IsoDateTime;
  description?: string;
  status?: StatusName;
};

/**
 * The adoption from the request to the day it happened, oldest first: sent, approved, the Meet & Greet confirmed
 * (with when and where the two met), and adopted. A step the API has no date for isn't shown, so nothing is made up.
 */
export function adoptionTimeline(record: AdoptionRecord): AdoptionEvent[] {
  const pet = record.pet.name;
  const home = record.home_profile.full_name;
  const { sent_at, approved_at, meet_scheduled_at } = record.timeline;
  const met = record.meeting ? `They met on ${formatMeetingTime(record.meeting.starts_at)} at ${slotPlace(record.meeting)}.` : undefined;

  const events: (AdoptionEvent | null)[] = [
    sent_at ? { id: "sent", title: `${pet} sent an adoption request`, at: sent_at } : null,
    approved_at ? { id: "approved", title: `${home} approved it`, at: approved_at } : null,
    meet_scheduled_at ? { id: "meet", title: "The Meet & Greet was confirmed", at: meet_scheduled_at, description: met } : null,
    record.adopted_at ? { id: "adopted", title: `${home} chose Adopt, and ${pet} got Hired`, at: record.adopted_at, status: "Adopted" } : null,
  ];
  return events.filter((event): event is AdoptionEvent => event !== null);
}

/** "15 days", "1 day"; null when the API didn't say. */
export function daysToAdoption(days: number | null): string | null {
  if (days === null) return null;
  return `${days} ${days === 1 ? "day" : "days"}`;
}
