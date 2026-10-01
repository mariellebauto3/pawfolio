import { HOME_PROFILES } from "@/lib/api/mock/fixtures/home-profiles";
import { PETS } from "@/lib/api/mock/fixtures/pets";
import type { AdoptionRequest } from "@/types/adoption-request";
import type { HomeProfileSummary } from "@/types/home-profile";
import type { PetSummary } from "@/types/pet";

// Made-up adoption requests (SEC-PRIV-06). Mochi is In Process with Ana, as in the LoFi.

export function petSummary(petId: number): PetSummary {
  const pet = PETS.find((p) => p.id === petId);
  if (!pet) throw new Error(`Mock pet ${petId} does not exist.`);
  const { id, name, species, breed, city, status } = pet;
  return { id, name, species, breed, city, status, photo_url: pet.photos[0]?.url ?? null };
}

export function homeProfileSummary(homeProfileId: number): HomeProfileSummary {
  const home = HOME_PROFILES.find((h) => h.id === homeProfileId);
  if (!home) throw new Error(`Mock Home Profile ${homeProfileId} does not exist.`);
  const { id, full_name, city, profile_photo_url, is_furparent } = home;
  return { id, full_name, city, profile_photo_url, is_furparent };
}

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
    sent_at: "2026-09-28T11:00:00.000000Z",
    expires_at: "2026-10-12T11:00:00.000000Z",
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
];
