import { ROUTES } from "@/constants/routes";

// The search page's URL (DS-03): `/search?q=quezon+city&type=pets&page=2`. The words are search terms only, never
// personal data, so they are fine in the URL (SEC-FE-04).

/** The same parameter the top-bar search writes (`SEARCH_QUERY_PARAM` in member-search.tsx). */
export const SEARCH_PARAM = "q";

/** Which kind of result is open; left out for the overview of all three. */
export const SEARCH_TYPE_PARAM = "type";

export const SEARCH_PAGE_PARAM = "page";

/** Longest search the box accepts. */
export const SEARCH_MAX = 100;

/** How many of each kind the overview shows before "See all". */
export const SEARCH_PREVIEW = 5;

/** Rows on a page of one kind. */
export const SEARCH_PAGE_SIZE = 20;

export const SEARCH_KINDS = ["pets", "homes", "posts"] as const;
export type SearchKind = (typeof SEARCH_KINDS)[number];

/** How many results there are of each kind, whichever kind is open. */
export type SearchTotals = Record<SearchKind, number>;

type UrlParams = Record<string, string | string[] | undefined>;

const one = (params: UrlParams, name: string) => {
  const value = params[name];
  return (Array.isArray(value) ? value[0] : value) ?? "";
};

/** What was searched for, read from the page's URL; "" when nothing was. */
export function searchFromUrl(params: UrlParams): string {
  return one(params, SEARCH_PARAM).trim().slice(0, SEARCH_MAX);
}

/** The kind that is open, or null for the overview. Anything unknown is the overview. */
export function searchKindFromUrl(params: UrlParams): SearchKind | null {
  const type = one(params, SEARCH_TYPE_PARAM);
  return (SEARCH_KINDS as readonly string[]).includes(type) ? (type as SearchKind) : null;
}

/** The page of the open kind, 1-based. */
export function searchPageFromUrl(params: UrlParams): number {
  const page = one(params, SEARCH_PAGE_PARAM);
  return /^\d{1,6}$/.test(page) ? Math.max(Number(page), 1) : 1;
}

/** The search page for these words: the overview, or one kind on a page. */
export function searchHref(search: string, kind: SearchKind | null = null, page = 1): string {
  const params = new URLSearchParams({ [SEARCH_PARAM]: search });
  if (kind) params.set(SEARCH_TYPE_PARAM, kind);
  if (kind && page > 1) params.set(SEARCH_PAGE_PARAM, String(page));
  return `${ROUTES.search}?${params}`;
}

/** "12 results", "1 result". */
export function resultCount(count: number): string {
  return `${count} ${count === 1 ? "result" : "results"}`;
}
