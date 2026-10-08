import { HOME_PROFILES } from "@/lib/api/mock/fixtures/home-profiles";
import { PETS } from "@/lib/api/mock/fixtures/pets";
import type { AdoptionRequest, RequestHome, RequestPet } from "@/types/adoption-request";

// Made-up adoption requests (SEC-PRIV-06). Mochi is In Process with Ana, as in the LoFi, so its request to Paolo is
// On Hold (RQ-15); Marco declined it a week ago (RQ-17), so the 30-day cooldown with his home is still running.

/** The pet as a request names it: the summary, and the age a row of the inbox shows. */
export function petSummary(petId: number): RequestPet {
  const pet = PETS.find((p) => p.id === petId);
  if (!pet) throw new Error(`Mock pet ${petId} does not exist.`);
  const { id, name, species, breed, city, status, approximate_age_months } = pet;
  return { id, name, species, breed, city, status, approximate_age_months, photo_url: pet.photos[0]?.url ?? null };
}

/** The home as a request names it: the summary, and the two public facts a row of My requests shows. */
export function homeProfileSummary(homeProfileId: number): RequestHome {
  const home = HOME_PROFILES.find((h) => h.id === homeProfileId);
  if (!home) throw new Error(`Mock Home Profile ${homeProfileId} does not exist.`);
  const { id, full_name, city, profile_photo_url, is_furparent, home_type, household_members } = home;
  return { id, full_name, city, profile_photo_url, is_furparent, home_type, household_members };
}

/** A date counted back from today, so a cooldown that depends on "now" is always still running. */
const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

const EMPTY: Omit<AdoptionRequest, "id" | "status" | "pet" | "home_profile" | "cover_letter"> = {
  caretaker_notes: null,
  approval_message: null,
  decline_reason: null,
  decision_message: null,
  withdraw_reason: null,
  sent_at: null,
  expires_at: null,
  approved_at: null,
  meet_scheduled_at: null,
  awaiting_decision_at: null,
  closed_at: null,
};

export const ADOPTION_REQUESTS: AdoptionRequest[] = [
  {
    ...EMPTY,
    id: 1,
    status: "meet_scheduled",
    pet: petSummary(1),
    home_profile: homeProfileSummary(1),
    cover_letter:
      "I'm calm indoors and love long walks, which sounds just like your weekends. I already get along with cats, too!",
    caretaker_notes: "Mochi is fully vaccinated and spayed.",
    approval_message: "We'd love to meet Mochi! Saturday works for us.",
    sent_at: "2026-09-20T09:00:00.000000Z",
    approved_at: "2026-09-22T10:30:00.000000Z",
    meet_scheduled_at: "2026-09-23T14:00:00.000000Z",
  },
  {
    ...EMPTY,
    id: 2,
    status: "on_hold",
    pet: petSummary(1),
    home_profile: homeProfileSummary(3),
    cover_letter:
      "A yard and two teenagers to play fetch with? I'd be the happiest dog in Makati. I'm house-trained and gentle.",
    sent_at: "2026-09-19T16:00:00.000000Z",
    expires_at: "2026-10-03T16:00:00.000000Z",
  },
  {
    ...EMPTY,
    id: 3,
    status: "sent",
    pet: petSummary(5),
    home_profile: homeProfileSummary(1),
    cover_letter:
      "I have a lot of energy and I'm still learning to sit, but I learn fast. Your active weekends sound perfect for me.",
    // Counted from today, so the one new request in the inbox never expires on its own.
    sent_at: daysAgo(3),
    expires_at: daysAgo(-11),
  },
  {
    ...EMPTY,
    id: 4,
    status: "declined",
    pet: petSummary(6),
    home_profile: homeProfileSummary(1),
    cover_letter:
      "I'm a calm lap cat who likes quiet afternoons. I'd keep you company while you work from home.",
    decline_reason: "another_pet_joining",
    sent_at: "2026-09-10T08:00:00.000000Z",
    closed_at: "2026-09-12T08:00:00.000000Z",
  },
  {
    ...EMPTY,
    id: 5,
    status: "declined",
    pet: petSummary(1),
    home_profile: homeProfileSummary(4),
    cover_letter: "I'm calm in a condo once I've had my walk, and long evening walks are my favourite part of the day.",
    caretaker_notes: "Mochi walks well on a leash.",
    decline_reason: "not_adopting_now",
    decision_message: "Thank you, Mochi. We decided to wait a few months before adopting.",
    sent_at: daysAgo(12),
    closed_at: daysAgo(8),
  },
];
