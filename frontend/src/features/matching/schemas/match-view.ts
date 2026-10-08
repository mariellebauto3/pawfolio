import { ROUTES } from "@/constants/routes";
import type { Query } from "@/lib/api/core";
import type { Role } from "@/types/statuses";

// Pets for You and Homes for You (MT-01, MT-02) keep what they show in the URL, so a view can be linked, reloaded
// and gone back to:
//   /matches?show=dogs&sort=newest&page=2
// These are the rules for reading that URL, writing it, and turning it into the API's query
// (docs/api/profiles-and-matching.md). Anything the URL holds that isn't a known value is dropped, so a hand-edited
// link shows matches instead of an error. The API checks its own input either way (SEC-INPUT-03).

/** What the list holds: a human is matched with pets, a pet with homes (proposal §9). */
export type MatchKind = "pets" | "homes";

export function matchKindFor(role: Role): MatchKind | null {
  return role === "human" ? "pets" : role === "pet" ? "homes" : null;
}

export const MATCH_SORTS = ["best_match", "newest"] as const;
export type MatchSort = (typeof MATCH_SORTS)[number];

export const MATCH_SORT_LABELS = {
  best_match: "Best match",
  newest: "Newest",
} as const satisfies Record<MatchSort, string>;

/** Cards per page: four rows of three on a desktop. */
export const MATCHES_PAGE_SIZE = 12;

export const MATCH_PARAMS = { show: "show", sort: "sort", page: "page" } as const;

export type QuickFilter = {
  /** The value in the URL: `?show=dogs`. */
  id: string;
  label: string;
  /** What the API is asked for when it is picked. */
  query: Query;
  /** The matches it leaves, for the count and the empty state: "dogs", "homes with kids". */
  noun: string;
};

/** MT-01: the quick filters over Pets for You. One at a time; Browse has the full set. */
export const PET_QUICK_FILTERS: readonly QuickFilter[] = [
  { id: "dogs", label: "Dogs", query: { species: "dog" }, noun: "dogs" },
  { id: "cats", label: "Cats", query: { species: "cat" }, noun: "cats" },
  { id: "small", label: "Small", query: { size: "small" }, noun: "small pets" },
  { id: "senior", label: "Senior", query: { age: "senior" }, noun: "senior pets" },
];

/** MT-02: the quick filters over Homes for You. */
export const HOME_QUICK_FILTERS: readonly QuickFilter[] = [
  { id: "houses", label: "Houses", query: { home_type: "house" }, noun: "houses" },
  { id: "condos", label: "Condos", query: { home_type: "condo" }, noun: "condos" },
  { id: "with-kids", label: "With kids", query: { has_kids: "yes" }, noun: "homes with kids" },
  { id: "no-other-pets", label: "No other pets", query: { has_other_pets: "none" }, noun: "homes without other pets" },
];

export function quickFiltersFor(kind: MatchKind): readonly QuickFilter[] {
  return kind === "pets" ? PET_QUICK_FILTERS : HOME_QUICK_FILTERS;
}

export type MatchView = {
  /** The quick filter picked, by id; "" for all of them. */
  show: string;
  sort: MatchSort;
  /** 1-based. */
  page: number;
};

export const ALL_MATCHES: MatchView = { show: "", sort: "best_match", page: 1 };

type UrlParams = Record<string, string | string[] | undefined>;

/** What the page shows, read from its URL. */
export function matchViewFromUrl(kind: MatchKind, params: UrlParams): MatchView {
  const one = (name: string) => {
    const value = params[name];
    return ((Array.isArray(value) ? value[0] : value) ?? "").trim();
  };
  const show = one(MATCH_PARAMS.show);
  const sort = one(MATCH_PARAMS.sort);
  const page = /^\d{1,6}$/.test(one(MATCH_PARAMS.page)) ? Number(one(MATCH_PARAMS.page)) : 1;

  return {
    show: quickFiltersFor(kind).some((filter) => filter.id === show) ? show : ALL_MATCHES.show,
    sort: (MATCH_SORTS as readonly string[]).includes(sort) ? (sort as MatchSort) : ALL_MATCHES.sort,
    page: Math.max(page, 1),
  };
}

/** The view as query parameters, leaving out everything that is at its default so URLs stay short. */
export function matchSearchParams(view: MatchView): Record<string, string> {
  const params: Record<string, string> = {};
  if (view.show) params[MATCH_PARAMS.show] = view.show;
  if (view.sort !== ALL_MATCHES.sort) params[MATCH_PARAMS.sort] = view.sort;
  if (view.page > 1) params[MATCH_PARAMS.page] = String(view.page);
  return params;
}

/** The page's address for a view: `/matches?show=dogs&page=2`, or `/matches` for everything. */
export function matchesHref(view: MatchView): string {
  const query = new URLSearchParams(matchSearchParams(view)).toString();
  return query ? `${ROUTES.matches}?${query}` : ROUTES.matches;
}

/** The quick filter that is on, if any. */
export function pickedQuickFilter(kind: MatchKind, view: MatchView): QuickFilter | undefined {
  return quickFiltersFor(kind).find((filter) => filter.id === view.show);
}

/** What `GET /matches` is asked for. */
export function matchesApiQuery(kind: MatchKind, view: MatchView): Query {
  return {
    ...pickedQuickFilter(kind, view)?.query,
    sort: view.sort,
    page: view.page > 1 ? view.page : undefined,
    per_page: MATCHES_PAGE_SIZE,
  };
}
