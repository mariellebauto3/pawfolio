import { ADOPTION_REQUESTS } from "@/lib/api/mock/fixtures/adoption-requests";
import { HOME_PROFILES } from "@/lib/api/mock/fixtures/home-profiles";
import { MATCH_SCORES } from "@/lib/api/mock/fixtures/match-scores";
import { PETS } from "@/lib/api/mock/fixtures/pets";
import { type MockResult, type MockRoute, fail, paginate, route, validationFailed } from "@/lib/api/mock/router";
import type { Account } from "@/types/account";

// Bookmarks in mock mode (docs/api/bookmarks-and-invites.md): a human saves pets and a pet saves homes, with the
// same answers as the API. What is saved or removed lives in memory, so it is back to these after a reload, and a
// page rendered on the server doesn't see what the browser changed.

type Bookmark = { id: number; user_id: number; pet_id: number | null; home_profile_id: number | null; created_at: string };

// Ana Santos (account 2) saved three pets, one of them adopted since; Mochi (account 1) saved two homes.
const BOOKMARKS: Bookmark[] = [
  { id: 1, user_id: 2, pet_id: 3, home_profile_id: null, created_at: "2026-09-21T09:10:00.000000Z" },
  { id: 2, user_id: 2, pet_id: 4, home_profile_id: null, created_at: "2026-09-24T18:40:00.000000Z" },
  { id: 3, user_id: 2, pet_id: 6, home_profile_id: null, created_at: "2026-10-02T07:25:00.000000Z" },
  { id: 4, user_id: 1, pet_id: null, home_profile_id: 3, created_at: "2026-09-18T12:00:00.000000Z" },
  { id: 5, user_id: 1, pet_id: null, home_profile_id: 1, created_at: "2026-09-19T20:15:00.000000Z" },
];

/** Admins have no bookmarks (403), like the `role:pet,human` middleware. */
function refusedRole(account: Account | null): MockResult | null {
  return account?.role === "pet" || account?.role === "human" ? null : fail(403, "You do not have permission to perform this action.");
}

const newestFirst = (a: Bookmark, b: Bookmark) => b.created_at.localeCompare(a.created_at) || b.id - a.id;

/** A pet anyone may open: published. Every fixture pet's account is Active. */
const visiblePet = (petId: number | null) => PETS.find((pet) => pet.id === petId && pet.status !== "draft");

/** A home this pet may open: Open to Adopt, or one it already has a request with (HomeProfilePolicy). */
function visibleHome(homeProfileId: number | null, petId: number | null) {
  const home = HOME_PROFILES.find((h) => h.id === homeProfileId);
  const related = ADOPTION_REQUESTS.some((request) => request.pet.id === petId && request.home_profile.id === homeProfileId);
  return home && (home.is_open_to_adopt || related) ? home : undefined;
}

const scored = <T extends object>(profile: T, petId: number | null, homeProfileId: number | null) => {
  const score = MATCH_SCORES[`${petId}:${homeProfileId}`];
  return { ...profile, is_bookmarked: true, ...(score === undefined ? {} : { match_score: score, match_reasons: [] }) };
};

export const bookmarkRoutes: MockRoute[] = [
  route("GET", "/bookmarks", ({ query, account }) => {
    const refused = refusedRole(account);
    if (!account || refused) return refused ?? fail(401, "Unauthenticated.");
    const own = BOOKMARKS.filter((bookmark) => bookmark.user_id === account.id).sort(newestFirst);

    // Profiles that may no longer be opened are left out, and out of the total.
    const rows = own.flatMap(({ id, created_at, pet_id, home_profile_id }): unknown[] => {
      if (account.role === "human") {
        const pet = visiblePet(pet_id);
        return pet ? [{ id, created_at, pet: scored(pet, pet.id, account.profile_id) }] : [];
      }
      const home = visibleHome(home_profile_id, account.profile_id);
      return home ? [{ id, created_at, home_profile: scored(home, account.profile_id, home.id) }] : [];
    });

    return { status: 200, body: paginate(rows, query, "/api/v1/bookmarks") };
  }),

  route("POST", "/bookmarks", ({ body, account }) => {
    const refused = refusedRole(account);
    if (!account || refused) return refused ?? fail(401, "Unauthenticated.");
    const sent = (body ?? {}) as { pet_id?: unknown; home_profile_id?: unknown };
    const human = account.role === "human";
    const [savedField, refusedField] = human ? (["pet_id", "home_profile_id"] as const) : (["home_profile_id", "pet_id"] as const);

    const errors: Record<string, string> = {};
    const targetId = sent[savedField];
    if (!Number.isInteger(targetId) || (targetId as number) < 1) {
      errors[savedField] = human ? "Choose a pet to bookmark." : "Choose a Home Profile to bookmark.";
    }
    if (sent[refusedField] !== undefined) {
      errors[refusedField] = human ? "A human bookmarks pets, not Home Profiles." : "A pet bookmarks Home Profiles, not other pets.";
    }
    if (Object.keys(errors).length) return validationFailed(errors);

    // A profile the account may not open answers like one that doesn't exist (SEC-AUTHZ-04).
    const pet = human ? visiblePet(targetId as number) : undefined;
    const home = human ? undefined : visibleHome(targetId as number, account.profile_id);
    if (human && !pet) return fail(404, "We couldn't find that pet.");
    if (!human && !home) return fail(404, "We couldn't find that Home Profile.");
    if (pet?.status === "adopted_hired") {
      return fail(409, `${pet.name} has already been adopted, so this resume can't be bookmarked.`, { code: "pet_already_adopted" });
    }

    // Saving twice keeps the first bookmark: 200 instead of 201.
    const existing = BOOKMARKS.find((bookmark) => bookmark.user_id === account.id && bookmark[savedField] === targetId);
    const bookmark: Bookmark = existing ?? {
      id: Math.max(0, ...BOOKMARKS.map((b) => b.id)) + 1,
      user_id: account.id,
      pet_id: pet?.id ?? null,
      home_profile_id: home?.id ?? null,
      created_at: new Date().toISOString(),
    };
    if (!existing) BOOKMARKS.push(bookmark);

    const { id, pet_id, home_profile_id, created_at } = bookmark;
    return { status: existing ? 200 : 201, body: { data: { id, pet_id, home_profile_id, created_at } } };
  }),

  // By the profile saved. Nothing to remove is the same answer, and the profile isn't looked up.
  route("DELETE", "/bookmarks/pets/:petId", ({ params, account }) => refusedRole(account) ?? unsave(account, "pet_id", params.petId)),
  route("DELETE", "/bookmarks/home-profiles/:homeProfileId", ({ params, account }) => {
    return refusedRole(account) ?? unsave(account, "home_profile_id", params.homeProfileId);
  }),

  route("DELETE", "/bookmarks/:bookmarkId", ({ params, account }) => {
    const refused = refusedRole(account);
    if (refused) return refused;
    // Someone else's bookmark answers like one that doesn't exist (SEC-AUTHZ-04).
    const index = BOOKMARKS.findIndex((bookmark) => String(bookmark.id) === params.bookmarkId && bookmark.user_id === account?.id);
    if (index < 0) return fail(404, "We couldn't find that bookmark.");
    BOOKMARKS.splice(index, 1);
    return { status: 204 };
  }),
];

function unsave(account: Account | null, field: "pet_id" | "home_profile_id", targetId: string): MockResult {
  const index = BOOKMARKS.findIndex((bookmark) => bookmark.user_id === account?.id && String(bookmark[field]) === targetId);
  if (index >= 0) BOOKMARKS.splice(index, 1);
  return { status: 204 };
}
