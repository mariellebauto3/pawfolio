import { type ApiClient, apiPath } from "@/lib/api/core";
import { isHome, isPet, isRecord, isText, readPage, unexpected } from "@/lib/api/readers";
import type { ApiResource } from "@/types/api";
import { DEALBREAKERS, type Dealbreaker } from "@/types/match";
import { type MatchView, matchesApiQuery } from "../schemas/match-view";
import {
  type HomeMatch,
  INELIGIBLE_REASONS,
  type IneligibleReason,
  type MatchBreakdown,
  type MatchCriterion,
  type Matches,
  type PetMatch,
} from "../types/matching";

// Matching calls (docs/api/profiles-and-matching.md, MT-01…MT-05, FR5, FR21). All reads: the list works from Server
// Components with `getServerApi()`, the breakdown from the browser when its dialog opens. The API decides who is
// listed (dealbreakers first, then only published pets and homes that are Open to Adopt) and whose side the viewer
// is on: the pet or the Home Profile comes from the session, never from the request (SEC-AUTHZ-02).

const LIST_PROBLEM = "We couldn't load your matches. Please try again.";
const BREAKDOWN_PROBLEM = "We couldn't load this breakdown. Please try again.";

const hasScore = (row: Record<string, unknown>) => typeof row.score === "number" && Number.isFinite(row.score);

const reasonsOf = (row: Record<string, unknown>) => (Array.isArray(row.reasons) ? row.reasons.filter(isText) : []);

// A row without a score or without a profile that matches the contract isn't shown: a ranked list never shows a
// card it can't explain.
function isPetMatch(row: unknown): row is PetMatch {
  return isRecord(row) && hasScore(row) && isPet(row.pet);
}

function isHomeMatch(row: unknown): row is HomeMatch {
  return isRecord(row) && hasScore(row) && isHome(row.home_profile);
}

/**
 * A page of matches, or why there is none. The endpoint always answers in the shape of a list; `meta.eligible` is
 * false, with a `reason`, for an account that has no matches yet. A reason this screen doesn't know is read as
 * `fallback`, the one that fits the role.
 */
function readMatches<T extends PetMatch | HomeMatch>(
  response: unknown,
  isRow: (row: unknown) => row is T,
  fallback: IneligibleReason,
): Matches<T> {
  const page = readPage(response, isRow, LIST_PROBLEM);
  const meta: Record<string, unknown> = page.meta;
  if (meta.eligible === false) {
    const known = (INELIGIBLE_REASONS as readonly unknown[]).includes(meta.reason);
    return { eligible: false, reason: known ? (meta.reason as IneligibleReason) : fallback };
  }
  return { eligible: true, page: { ...page, data: page.data.map((row) => ({ ...row, reasons: reasonsOf(row) })) } };
}

/** Pets for You (MT-01): the pets that pass the human's dealbreakers, best score first. MT-04 until the quiz is finished. */
export async function getPetMatches(client: ApiClient, view: MatchView): Promise<Matches<PetMatch>> {
  const response = await client.get<unknown>("/matches", { query: matchesApiQuery("pets", view) });
  return readMatches(response, isPetMatch, "quiz_incomplete");
}

/** Homes for You (MT-02): the Open to Adopt homes that pass the dealbreakers with this pet. MT-05 while the resume is a Draft. */
export async function getHomeMatches(client: ApiClient, view: MatchView): Promise<Matches<HomeMatch>> {
  const response = await client.get<unknown>("/matches", { query: matchesApiQuery("homes", view) });
  return readMatches(response, isHomeMatch, "resume_draft");
}

function isCriterion(value: unknown): value is MatchCriterion {
  return (
    isRecord(value) &&
    isText(value.key) &&
    isText(value.label) &&
    typeof value.points === "number" &&
    typeof value.max_points === "number" &&
    value.max_points > 0
  );
}

/**
 * How the viewer and one profile fit (MT-03). `profileId` is the other side of the pair: the pet's id when a human
 * asks, the Home Profile's id when a pet asks. 404 for a profile the viewer may not open, and when there is no
 * score to explain (the viewer's quiz isn't finished, or their resume is a Draft).
 */
export async function getMatchBreakdown(client: ApiClient, profileId: number, signal?: AbortSignal): Promise<MatchBreakdown> {
  const data = (await client.get<ApiResource<unknown>>(apiPath`/matches/${profileId}/breakdown`, { signal }))?.data;
  if (!isRecord(data) || typeof data.score !== "number" || typeof data.passed_dealbreakers !== "boolean" || !Array.isArray(data.criteria)) {
    throw unexpected(BREAKDOWN_PROBLEM);
  }
  const failed = Array.isArray(data.failed_dealbreakers) ? data.failed_dealbreakers : [];
  return {
    score: data.score,
    passed_dealbreakers: data.passed_dealbreakers,
    failed_dealbreakers: failed.filter((key): key is Dealbreaker => (DEALBREAKERS as readonly unknown[]).includes(key)),
    criteria: data.criteria.filter(isCriterion),
    reasons: reasonsOf(data),
  };
}
