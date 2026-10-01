import { HOME_PROFILES } from "@/lib/api/mock/fixtures/home-profiles";
import { PETS } from "@/lib/api/mock/fixtures/pets";
import { type MockRoute, fail, ok, paginate, route } from "@/lib/api/mock/router";

// Draft résumés are hidden from everyone but their pet (§5.2, PR-02).
const isVisible = (petId: number, status: string, viewerPetId: number | null) =>
  status !== "draft" || petId === viewerPetId;

export const profileRoutes: MockRoute[] = [
  route("GET", "/pets", ({ query }) =>
    ({ status: 200, body: paginate(PETS.filter((pet) => pet.status !== "draft"), query, "/api/v1/pets") }),
  ),

  route("GET", "/pets/:petId", ({ params, account }) => {
    const viewerPetId = account?.role === "pet" ? account.profile_id : null;
    const pet = PETS.find((p) => String(p.id) === params.petId);
    if (!pet || !isVisible(pet.id, pet.status, viewerPetId)) return fail(404, "We couldn't find that pet.");
    return ok(pet);
  }),

  route("GET", "/home-profiles/:homeProfileId", ({ params }) => {
    const home = HOME_PROFILES.find((h) => String(h.id) === params.homeProfileId);
    return home ? ok(home) : fail(404, "We couldn't find that Home Profile.");
  }),
];
