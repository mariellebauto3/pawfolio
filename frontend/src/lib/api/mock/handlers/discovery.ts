import type { Query, QueryValue } from "@/lib/api/core";
import { ADOPTION_REQUESTS } from "@/lib/api/mock/fixtures/adoption-requests";
import { HOME_PROFILES } from "@/lib/api/mock/fixtures/home-profiles";
import { MATCH_REASONS, MATCH_SCORES } from "@/lib/api/mock/fixtures/match-scores";
import { PETS } from "@/lib/api/mock/fixtures/pets";
import { RECENTLY_HIRED } from "@/lib/api/mock/fixtures/recently-hired";
import { isBookmarked } from "@/lib/api/mock/handlers/bookmarks";
import { liveInviteAt } from "@/lib/api/mock/handlers/invites";
import { type MockRoute, fail, ok, paginate, route, validationFailed } from "@/lib/api/mock/router";
import type { Account } from "@/types/account";
import type { HomeProfile } from "@/types/home-profile";
import type { Pet } from "@/types/pet";

// Discovery in mock mode (docs/api/discovery.md): Browse, the two profile pages and search, answered from the
// fixtures with the same rules about who is listed. Scores are made up (fixtures/match-scores.ts); the real ones
// come from the matching rules on the server.

const listOf = (value: QueryValue) =>
  String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const mentions = (search: string, ...texts: (string | null)[]) => texts.some((text) => text?.toLowerCase().includes(search));

/** The pet and home whose score the viewer sees: their own side, and the profile they are reading. */
function scoreFor(account: Account | null, other: { petId?: number; homeId?: number }): number | undefined {
  const petId = account?.role === "pet" ? account.profile_id : other.petId;
  const homeId = account?.role === "human" ? account.profile_id : other.homeId;
  return account?.role === "admin" ? undefined : MATCH_SCORES[`${petId}:${homeId}`];
}

function matchFor(score: number | undefined) {
  return score === undefined ? undefined : { passed_dealbreakers: true, failed_dealbreakers: [], score, reasons: MATCH_REASONS };
}

const AGE_GROUPS: Record<string, (months: number) => boolean> = {
  puppy_kitten: (months) => months <= 12,
  adult: (months) => months >= 13 && months <= 84,
  senior: (months) => months > 84,
};

function petsMatching(query: Query): Pet[] {
  const search = String(query.q ?? "").trim().toLowerCase();
  const species = listOf(query.species);
  const sizes = listOf(query.size);
  const ages = listOf(query.age);
  const temperament = listOf(query.temperament);
  const goodWith = listOf(query.good_with);
  const province = String(query.province ?? "");

  return PETS.filter((pet) => {
    // Drafts and adopted pets are never listed (§5.2).
    if (pet.status !== "looking_for_a_home") return false;
    if (search && !mentions(search, pet.name, pet.breed, pet.city, pet.bio, ...pet.temperament_tags)) return false;
    if (species.length && !species.includes(pet.species)) return false;
    if (sizes.length && !(pet.size && sizes.includes(pet.size))) return false;
    if (ages.length && !ages.some((group) => AGE_GROUPS[group]?.(pet.approximate_age_months))) return false;
    if (temperament.length && !temperament.some((tag) => pet.temperament_tags.includes(tag))) return false;
    if (goodWith.includes("kids") && pet.good_with_kids !== "yes") return false;
    if (goodWith.includes("dogs") && pet.good_with_dogs !== "yes") return false;
    if (goodWith.includes("cats") && pet.good_with_cats !== "yes") return false;
    return !province || pet.province === province;
  }).sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""));
}

const isListed = (home: HomeProfile) => home.is_open_to_adopt && home.has_completed_quiz;

const hasKids = (home: HomeProfile) => home.household_members.some((member) => member === "kids_under_6" || member === "kids_6_to_12");

function homesMatching(query: Query): HomeProfile[] {
  const search = String(query.q ?? "").trim().toLowerCase();
  const types = listOf(query.home_type);
  const spaces = listOf(query.outdoor_space);
  const activity = listOf(query.activity_level);
  const otherPets = listOf(query.has_other_pets);
  const kids = String(query.has_kids ?? "");

  return HOME_PROFILES.filter((home) => {
    if (!isListed(home)) return false;
    if (search && !mentions(search, home.full_name, home.headline, home.city, home.about_home)) return false;
    if (types.length && !(home.home_type && types.includes(home.home_type))) return false;
    if (spaces.length && !(home.outdoor_space && spaces.includes(home.outdoor_space))) return false;
    if (activity.length && !(home.activity_level && activity.includes(home.activity_level))) return false;
    if (otherPets.includes("none") && home.other_pets.length > 0) return false;
    if (otherPets.length && !otherPets.includes("none") && !home.other_pets.some((kind) => otherPets.includes(kind))) return false;
    if (kids === "yes" && !hasKids(home)) return false;
    return !(kids === "no" && hasKids(home));
  });
}

/** Best match first, the way the API sorts when the viewer has scores; rows without one keep their order after. */
function byScore<T>(rows: T[], query: Query, score: (row: T) => number | undefined): T[] {
  if (query.sort && query.sort !== "best_match") return rows;
  return [...rows].sort((a, b) => (score(b) ?? -1) - (score(a) ?? -1));
}

const POSTS = [
  { id: 1, type: "for_hire", title: null, body: "Pepper's resume just went live. He is a curious Aspin from Marikina.", author_name: "Pepper", created_at: "2026-09-18T08:05:00.000000Z" },
  { id: 2, type: "adoption_story", title: "Luna's first week at home", body: "She found the sunniest windowsill in Quezon City on day one.", author_name: "Ana Santos", created_at: "2026-10-02T10:00:00.000000Z" },
];

/** `search_in=name`: rows whose name holds the words, the ones that start with them first, as the API orders them. */
function namesHolding<T>(rows: T[], typed: unknown, nameOf: (row: T) => string): T[] {
  const words = String(typed ?? "").trim().toLowerCase();
  const holding = rows.filter((row) => nameOf(row).toLowerCase().includes(words));
  return [...holding.filter((row) => nameOf(row).toLowerCase().startsWith(words)), ...holding.filter((row) => !nameOf(row).toLowerCase().startsWith(words))];
}

export const discoveryRoutes: MockRoute[] = [
  // Landing page strip (AU-01, docs/api/discovery.md): newest first, at most 8, public.
  route("GET", "/public/recently-hired", () => ok(RECENTLY_HIRED.slice(0, 8)), "public"),

  route("GET", "/pets", ({ query, account }) => {
    if (query.search_in === "name") return { status: 200, body: paginate(namesHolding(petsMatching({ ...query, q: undefined }), query.q, (pet) => pet.name), query, "/api/v1/pets") };
    const rows = petsMatching(query).map((pet) => ({ ...pet, match_score: scoreFor(account, { petId: pet.id }), is_bookmarked: isBookmarked(account, { petId: pet.id }) }));
    return { status: 200, body: paginate(byScore(rows, query, (row) => row.match_score), query, "/api/v1/pets") };
  }),

  route("GET", "/pets/:petId", ({ params, account }) => {
    const pet = PETS.find((p) => String(p.id) === params.petId);
    const own = account?.role === "pet" && account.profile_id === pet?.id;
    // Draft resumes are hidden from everyone but their pet (§5.2, PR-02).
    if (!pet || (pet.status === "draft" && !own)) return fail(404, "We couldn't find that pet.");
    const match = account?.role === "human" ? matchFor(scoreFor(account, { petId: pet.id })) : undefined;
    // A human also learns whether their own invite is with the pet (RQ-01).
    const invited = account?.role === "human" ? { invited_at: liveInviteAt(pet.id, account.profile_id) } : {};
    return ok({ ...pet, is_bookmarked: isBookmarked(account, { petId: pet.id }), match, ...invited });
  }),

  route("GET", "/home-profiles", ({ query, account }) => {
    if (query.search_in === "name") return { status: 200, body: paginate(namesHolding(homesMatching({ ...query, q: undefined }), query.q, (home) => home.full_name), query, "/api/v1/home-profiles") };
    const rows = homesMatching(query).map((home) => ({ ...home, match_score: scoreFor(account, { homeId: home.id }), is_bookmarked: isBookmarked(account, { homeProfileId: home.id }) }));
    return { status: 200, body: paginate(byScore(rows, query, (row) => row.match_score), query, "/api/v1/home-profiles") };
  }),

  route("GET", "/home-profiles/:homeProfileId", ({ params, account }) => {
    const home = HOME_PROFILES.find((h) => String(h.id) === params.homeProfileId);
    const own = account?.role === "human" && account.profile_id === home?.id;
    // A home that isn't Open to Adopt shows only to a pet that already has a request with it.
    const related = account?.role === "pet" && ADOPTION_REQUESTS.some((r) => r.pet.id === account.profile_id && r.home_profile.id === home?.id);
    if (!home || !(home.is_open_to_adopt || own || related || account?.role === "admin")) {
      return fail(404, "We couldn't find that Home Profile.");
    }
    const match = account?.role === "pet" ? matchFor(scoreFor(account, { homeId: home.id })) : undefined;
    return ok({ ...home, is_bookmarked: isBookmarked(account, { homeProfileId: home.id }), match });
  }),

  // The overview (the first few of each kind) or, with `type`, one kind a page at a time. Both carry the totals.
  route("GET", "/search", ({ query }) => {
    const search = String(query.q ?? "").trim();
    const words = search.toLowerCase();
    const found = {
      pets: search ? petsMatching({ q: search }) : [],
      home_profiles: search ? homesMatching({ q: search }) : [],
      posts: search ? POSTS.filter((post) => mentions(words, post.title, post.body)) : [],
    };
    const totals = { pets: found.pets.length, home_profiles: found.home_profiles.length, posts: found.posts.length };

    const type = String(query.type ?? "");
    if (type === "pets" || type === "home_profiles" || type === "posts") {
      const page = paginate<unknown>(found[type], query, "/api/v1/search");
      return { status: 200, body: { ...page, meta: { ...page.meta, query: search, totals } } };
    }
    if (type) return validationFailed({ type: "Choose pets, home_profiles or posts." });

    const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 25);
    return ok({
      query: search,
      pets: found.pets.slice(0, limit),
      home_profiles: found.home_profiles.slice(0, limit),
      posts: found.posts.slice(0, limit),
      totals,
    });
  }),
];
