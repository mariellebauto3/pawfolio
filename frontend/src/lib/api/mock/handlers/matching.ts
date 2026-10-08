import type { Query, QueryValue } from "@/lib/api/core";
import { ADOPTION_REQUESTS } from "@/lib/api/mock/fixtures/adoption-requests";
import { HOME_PROFILES } from "@/lib/api/mock/fixtures/home-profiles";
import { MATCH_REASONS, MATCH_SCORES, criteriaFor } from "@/lib/api/mock/fixtures/match-scores";
import { PETS } from "@/lib/api/mock/fixtures/pets";
import { isBookmarked } from "@/lib/api/mock/handlers/bookmarks";
import { type MockResult, type MockRoute, fail, paginate, route, validationFailed } from "@/lib/api/mock/router";
import type { HomeProfile } from "@/types/home-profile";
import type { Pet } from "@/types/pet";

// Matching in mock mode (docs/api/profiles-and-matching.md, "Compatibility Matches"): Pets for You, Homes for You
// and the breakdown, answered from the fixtures in the shapes the API uses, with the same rules about who is listed
// and who has matches at all.

const listOf = (value: QueryValue) =>
  String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

/** The filters the API checks against an allow-list (SEC-INPUT-03). A value that isn't listed is a 422. */
const ALLOWED: Record<string, readonly string[]> = {
  species: ["dog", "cat", "other"],
  size: ["small", "medium", "large"],
  age: ["puppy_kitten", "adult", "senior"],
  home_type: ["house", "condo", "apartment", "townhouse"],
  has_other_pets: ["none", "dogs", "cats", "other"],
  has_kids: ["yes", "no"],
  sort: ["best_match", "newest"],
};

function refused(query: Query): MockResult | null {
  for (const [name, allowed] of Object.entries(ALLOWED)) {
    if (listOf(query[name]).some((value) => !allowed.includes(value))) return validationFailed({ [name]: "Choose one of the listed options." });
  }
  return null;
}

const AGE_GROUPS: Record<string, (months: number) => boolean> = {
  puppy_kitten: (months) => months <= 12,
  adult: (months) => months >= 13 && months <= 84,
  senior: (months) => months > 84,
};

const hasYoungKids = (home: HomeProfile) => home.household_members.some((member) => member === "kids_under_6" || member === "kids_6_to_12");

function petFits(pet: Pet, query: Query): boolean {
  const species = listOf(query.species);
  const sizes = listOf(query.size);
  const ages = listOf(query.age);
  if (species.length && !species.includes(pet.species)) return false;
  if (sizes.length && !(pet.size && sizes.includes(pet.size))) return false;
  return !ages.length || ages.some((group) => AGE_GROUPS[group](pet.approximate_age_months));
}

function homeFits(home: HomeProfile, query: Query): boolean {
  const types = listOf(query.home_type);
  const otherPets = listOf(query.has_other_pets);
  if (types.length && !(home.home_type && types.includes(home.home_type))) return false;
  if (otherPets.includes("none") && home.other_pets.length > 0) return false;
  if (otherPets.length && !otherPets.includes("none") && !home.other_pets.some((kind) => otherPets.includes(kind))) return false;
  if (query.has_kids === "yes" && !hasYoungKids(home)) return false;
  return !(query.has_kids === "no" && hasYoungKids(home));
}

/** A page of matches in the shape of every list, plus whether the account has matches yet. */
function page(rows: readonly unknown[], query: Query, reason: string | null = null): MockResult {
  const body = paginate(rows, query, "/api/v1/matches");
  return { status: 200, body: { ...body, meta: { ...body.meta, eligible: reason === null, reason } } };
}

function row(id: number, score: number) {
  return {
    id,
    score,
    tier: score >= 80 ? "high" : score >= 60 ? "medium" : "low",
    passed_dealbreakers: true,
    reasons: MATCH_REASONS,
    criteria_scores: criteriaFor(score),
    calculated_at: "2026-10-01T02:00:00.000000Z",
  };
}

export const matchingRoutes: MockRoute[] = [
  route("GET", "/matches", ({ query, account }) => {
    if (account?.role !== "pet" && account?.role !== "human") return fail(403, "This action is unauthorized.");
    const invalid = refused(query);
    if (invalid) return invalid;
    const newest = query.sort === "newest";

    if (account.role === "human") {
      const home = HOME_PROFILES.find((h) => h.id === account.profile_id);
      if (!home?.has_completed_quiz) return page([], query, "quiz_incomplete");

      // Only pets that are Looking for a Home and pass the dealbreakers (the fixture has a score for those).
      const rows = PETS.filter((pet) => pet.status === "looking_for_a_home" && petFits(pet, query))
        .map((pet) => ({ pet, score: MATCH_SCORES[`${pet.id}:${home.id}`] }))
        .filter((match): match is { pet: Pet; score: number } => match.score !== undefined)
        .sort((a, b) => (newest ? (b.pet.published_at ?? "").localeCompare(a.pet.published_at ?? "") : 0) || b.score - a.score || b.pet.id - a.pet.id)
        .map(({ pet, score }) => ({ ...row(pet.id, score), pet: { ...pet, match_score: score, match_reasons: MATCH_REASONS, is_bookmarked: isBookmarked(account, { petId: pet.id }) } }));
      return page(rows, query);
    }

    const pet = PETS.find((p) => p.id === account.profile_id);
    if (!pet || pet.status === "draft") return page([], query, "resume_draft");
    if (pet.status === "adopted_hired") return page([], query, "already_adopted");

    const rows = HOME_PROFILES.filter((home) => home.is_open_to_adopt && home.has_completed_quiz && homeFits(home, query))
      .map((home) => ({ home, score: MATCH_SCORES[`${pet.id}:${home.id}`] }))
      .filter((match): match is { home: HomeProfile; score: number } => match.score !== undefined)
      .sort((a, b) => (newest ? b.home.id - a.home.id : 0) || b.score - a.score || b.home.id - a.home.id)
      .map(({ home, score }) => ({
        ...row(home.id, score),
        home_profile: { ...home, match_score: score, match_reasons: MATCH_REASONS, is_bookmarked: isBookmarked(account, { homeProfileId: home.id }) },
      }));
    return page(rows, query);
  }),

  // `profileId` is the other side of the pair: a pet for a human, a Home Profile for a pet.
  route("GET", "/matches/:profileId/breakdown", ({ params, account }) => {
    if (account?.role !== "pet" && account?.role !== "human") return fail(403, "Only pet and human accounts have matches.");
    const missing = fail(404, "We couldn't find that match.", { code: "not_found" });

    const pet = PETS.find((p) => (account.role === "pet" ? p.id === account.profile_id : String(p.id) === params.profileId));
    const home = HOME_PROFILES.find((h) => (account.role === "human" ? h.id === account.profile_id : String(h.id) === params.profileId));
    if (!pet || pet.status === "draft" || !home?.has_completed_quiz) return missing;
    // A home that isn't Open to Adopt is hidden, except from a pet that already has a request with it.
    const related = ADOPTION_REQUESTS.some((r) => r.pet.id === pet.id && r.home_profile.id === home.id);
    if (account.role === "pet" && !home.is_open_to_adopt && !related) return missing;

    const score = MATCH_SCORES[`${pet.id}:${home.id}`];
    const passed = score !== undefined;
    const failed = passed ? [] : ["ok_with_other_pets"];
    return {
      status: 200,
      body: {
        data: {
          pet_id: pet.id,
          home_profile_id: home.id,
          score: score ?? 0,
          tier: passed && score >= 80 ? "high" : passed && score >= 60 ? "medium" : "low",
          passed_dealbreakers: passed,
          failed_dealbreakers: failed,
          dealbreakers: { species_accepted: true, ok_with_kids: true, ok_with_other_pets: passed, same_province: true },
          criteria: criteriaFor(score ?? 0),
          criteria_scores: criteriaFor(score ?? 0),
          reasons: passed ? MATCH_REASONS : [],
        },
      },
    };
  }),
];
