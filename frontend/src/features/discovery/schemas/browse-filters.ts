import { ACTIVITY_LEVEL_LABELS, AGE_GROUP_LABELS, HOME_TYPE_LABELS, OUTDOOR_SPACE_LABELS } from "@/constants/home-profiles";
import { PET_SIZE_LABELS, SPECIES_LABELS, TEMPERAMENT_TAGS, optionsFrom } from "@/constants/pets";
import { PROVINCES } from "@/constants/provinces";
import { ROUTES, homeProfilePath, petPath } from "@/constants/routes";
import type { Query } from "@/lib/api/core";
import type { HomeProfile } from "@/types/home-profile";
import type { Pet } from "@/types/pet";
import type { Role } from "@/types/statuses";

// Browse (DS-01, DS-02) keeps everything it shows in the URL, so a view can be linked, reloaded and gone back to:
//   /browse?q=aspin&province=Metro+Manila&species=dog,cat&age=adult&sort=newest&page=2
// These are the rules for reading that URL, writing it, and turning it into the API's query
// (docs/api/discovery.md). Anything the URL holds that isn't a known value is dropped, so a hand-edited link shows
// results instead of an error. The API checks its own input either way (SEC-INPUT-03).

/** Humans browse pets; pets browse homes (proposal §9). */
export type BrowseKind = "pets" | "homes";

export const BROWSE_SORTS = ["best_match", "newest"] as const;
export type BrowseSort = (typeof BROWSE_SORTS)[number];

export const BROWSE_SORT_LABELS = {
  best_match: "Best match",
  newest: "Newest",
} as const satisfies Record<BrowseSort, string>;

/** Cards per page: four rows of three on a desktop. */
export const BROWSE_PAGE_SIZE = 12;

/** Longest search the box accepts, the same as the top-bar search. */
export const BROWSE_SEARCH_MAX = 100;

/**
 * How long the search box waits after the last key before it asks for results: long enough that a word typed at an
 * ordinary pace is one request, short enough that the list seems to follow the typing.
 */
export const BROWSE_SEARCH_DELAY_MS = 300;

/**
 * How long the box waits before it asks for the names that drop down under it. Shorter than the results' wait:
 * a suggestion is the first thing looked at, and one small answer is cheap.
 */
export const BROWSE_SUGGESTION_DELAY_MS = 150;

/** How many suggestions drop down under the search box. */
export const BROWSE_SUGGESTION_COUNT = 6;

export const BROWSE_PARAMS = { search: "q", province: "province", sort: "sort", page: "page" } as const;

export type FilterOption = { value: string; label: string };

export type FilterField = {
  /** The name in the URL. */
  name: string;
  /** The API's name for it, when that differs. */
  apiParam?: string;
  legend: string;
  options: FilterOption[];
  /** One answer only, with "Any" for none; the others take several. */
  single?: boolean;
};

/** DS-01: species, age, size, temperament, good with (FR6). */
export const PET_FILTER_FIELDS: readonly FilterField[] = [
  { name: "species", legend: "Species", options: optionsFrom(SPECIES_LABELS) },
  { name: "age", legend: "Age", options: optionsFrom(AGE_GROUP_LABELS) },
  { name: "size", legend: "Size", options: optionsFrom(PET_SIZE_LABELS) },
  { name: "temperament", legend: "Temperament", options: TEMPERAMENT_TAGS.map((tag) => ({ value: tag, label: tag })) },
  {
    name: "good_with",
    legend: "Good with",
    options: [
      { value: "kids", label: "Kids" },
      { value: "dogs", label: "Dogs" },
      { value: "cats", label: "Cats" },
    ],
  },
];

/** DS-02: home type, outdoor space, other pets, kids, activity (FR22). */
export const HOME_FILTER_FIELDS: readonly FilterField[] = [
  { name: "home_type", legend: "Home type", options: optionsFrom(HOME_TYPE_LABELS) },
  { name: "outdoor_space", legend: "Outdoor space", options: optionsFrom(OUTDOOR_SPACE_LABELS) },
  {
    name: "other_pets",
    apiParam: "has_other_pets",
    legend: "Other pets",
    single: true,
    options: [
      { value: "none", label: "None" },
      { value: "dogs", label: "Dogs" },
      { value: "cats", label: "Cats" },
    ],
  },
  {
    name: "kids",
    apiParam: "has_kids",
    legend: "Kids at home",
    single: true,
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
  },
  { name: "activity_level", legend: "Activity level", options: optionsFrom(ACTIVITY_LEVEL_LABELS) },
];

export function browseKindFor(role: Role): BrowseKind | null {
  return role === "human" ? "pets" : role === "pet" ? "homes" : null;
}

export function filterFieldsFor(kind: BrowseKind): readonly FilterField[] {
  return kind === "pets" ? PET_FILTER_FIELDS : HOME_FILTER_FIELDS;
}

export type BrowseFilters = {
  /** What was typed in the search box; "" for nothing. */
  search: string;
  /** "" for every province. */
  province: string;
  sort: BrowseSort;
  /** 1-based. */
  page: number;
  /** The values picked for each field, by field name, in the order the options are listed. */
  picked: Record<string, string[]>;
};

export const NO_FILTERS: BrowseFilters = { search: "", province: "", sort: "best_match", page: 1, picked: {} };

type UrlParams = Record<string, string | string[] | undefined>;

/** Every value given for a parameter, whether it came as `a=1,2`, as `a=1&a=2` or as both. */
function valuesOf(params: UrlParams, name: string): string[] {
  const raw = params[name];
  const list = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw];
  return list.flatMap((value) => value.split(",")).map((value) => value.trim());
}

/** What Browse shows, read from the page's URL. */
export function browseFiltersFromUrl(kind: BrowseKind, params: UrlParams): BrowseFilters {
  const one = (name: string) => {
    const value = params[name];
    return (Array.isArray(value) ? value[0] : value) ?? "";
  };
  const province = one(BROWSE_PARAMS.province).trim();
  const sort = one(BROWSE_PARAMS.sort);
  const page = /^\d{1,6}$/.test(one(BROWSE_PARAMS.page)) ? Number(one(BROWSE_PARAMS.page)) : 1;

  const picked: Record<string, string[]> = {};
  for (const field of filterFieldsFor(kind)) {
    const given = valuesOf(params, field.name);
    const known = field.options.map((option) => option.value).filter((value) => given.includes(value));
    if (known.length) picked[field.name] = field.single ? known.slice(0, 1) : known;
  }

  return {
    search: one(BROWSE_PARAMS.search).trim().slice(0, BROWSE_SEARCH_MAX),
    province: (PROVINCES as readonly string[]).includes(province) ? province : "",
    sort: (BROWSE_SORTS as readonly string[]).includes(sort) ? (sort as BrowseSort) : NO_FILTERS.sort,
    page: Math.max(page, 1),
    picked,
  };
}

/** The filters as query parameters, leaving out everything that is at its default so URLs stay short. */
function browseParams(kind: BrowseKind, filters: BrowseFilters): URLSearchParams {
  const params = new URLSearchParams();
  const search = filters.search.trim();
  if (search) params.set(BROWSE_PARAMS.search, search);
  if (filters.province) params.set(BROWSE_PARAMS.province, filters.province);
  for (const field of filterFieldsFor(kind)) {
    const values = filters.picked[field.name] ?? [];
    if (values.length) params.set(field.name, values.join(","));
  }
  if (filters.sort !== NO_FILTERS.sort) params.set(BROWSE_PARAMS.sort, filters.sort);
  if (filters.page > 1) params.set(BROWSE_PARAMS.page, String(filters.page));
  return params;
}

/** The Browse address for these filters: `/browse?species=dog&page=2`, or `/browse` for none. */
export function browseHref(kind: BrowseKind, filters: BrowseFilters): string {
  const query = browseParams(kind, filters).toString();
  return query ? `${ROUTES.browse}?${query}` : ROUTES.browse;
}

/** The same parameters as an object, for components that add the page number themselves (Pagination). */
export function browseSearchParams(kind: BrowseKind, filters: BrowseFilters): Record<string, string> {
  return Object.fromEntries(browseParams(kind, filters));
}

/** What `GET /pets` or `GET /home-profiles` is asked for. Lists travel as `a,b`, the way the API reads them. */
export function browseApiQuery(kind: BrowseKind, filters: BrowseFilters): Query {
  const query: Query = {
    q: filters.search.trim() || undefined,
    province: filters.province || undefined,
    sort: filters.sort,
    page: filters.page > 1 ? filters.page : undefined,
    per_page: BROWSE_PAGE_SIZE,
  };
  for (const field of filterFieldsFor(kind)) {
    const values = filters.picked[field.name] ?? [];
    if (values.length) query[field.apiParam ?? field.name] = values.join(",");
  }
  return query;
}

/**
 * What the list under the search box asks for: the same filters, the name alone (`search_in=name`), and only as
 * many rows as it shows. The API puts the names that start with the words first.
 */
export function suggestionApiQuery(kind: BrowseKind, filters: BrowseFilters): Query {
  return { ...browseApiQuery(kind, { ...filters, page: 1 }), search_in: "name", per_page: BROWSE_SUGGESTION_COUNT };
}

export type ActiveFilter = {
  /** Unique among the active filters. */
  key: string;
  label: string;
  /** Browse without this one filter, back on page 1. */
  href: string;
};

/** One chip for each thing that narrows the results, each with the link that removes it (DS-01). */
export function activeFilters(kind: BrowseKind, filters: BrowseFilters): ActiveFilter[] {
  const without = (change: Partial<BrowseFilters>) => browseHref(kind, { ...filters, ...change, page: 1 });
  const chips: ActiveFilter[] = [];

  const search = filters.search.trim();
  if (search) chips.push({ key: "search", label: `“${search}”`, href: without({ search: "" }) });
  if (filters.province) chips.push({ key: "province", label: filters.province, href: without({ province: "" }) });

  for (const field of filterFieldsFor(kind)) {
    const values = filters.picked[field.name] ?? [];
    for (const value of values) {
      const option = field.options.find((candidate) => candidate.value === value);
      if (!option) continue;
      const rest = values.filter((other) => other !== value);
      chips.push({
        key: `${field.name}:${value}`,
        // "Yes" and "None" say nothing on their own, so those chips carry the question too.
        label: field.single ? `${field.legend}: ${option.label}` : option.label,
        href: without({ picked: { ...filters.picked, [field.name]: rest } }),
      });
    }
  }
  return chips;
}

/**
 * The address without its search and its page: what the filter panel and the sort show. It changes only when one of
 * them does, so the panel can tell a new filter from the search box's own results coming back.
 */
export function browsePanelKey(kind: BrowseKind, filters: BrowseFilters): string {
  return browseHref(kind, { ...filters, search: "", page: 1 });
}

/**
 * What the search box does when the page shows results for `urlSearch`. `asked` are the searches the box itself
 * asked for and may still be waiting on, oldest first. One of those arriving is its own answer, and what is typed
 * stays as it is, since the typing may be further along by then. Anything else came from outside the box (a chip
 * removed, the back button, a link) and the box follows it.
 */
export function searchBoxAfter(urlSearch: string, asked: readonly string[]): { follow: boolean; asked: readonly string[] } {
  const at = asked.lastIndexOf(urlSearch);
  if (at === -1) return { follow: true, asked: [urlSearch] };
  // Answers older than this one can no longer arrive in a way that matters: forget them.
  return { follow: false, asked: asked.slice(at) };
}

/** One name in the list under the search box. */
export type Suggestion = {
  id: number;
  name: string;
  /** A second line that tells two of the same name apart: "Aspin · Quezon City". */
  detail: string;
  photo: string | null;
  /** The resume or Home Profile it opens. */
  href: string;
};

export function petSuggestion(pet: Pick<Pet, "id" | "name" | "breed" | "city" | "photos">): Suggestion {
  return { id: pet.id, name: pet.name, detail: [pet.breed, pet.city].filter(Boolean).join(" · "), photo: pet.photos[0]?.url ?? null, href: petPath(pet.id) };
}

export function homeSuggestion(home: Pick<HomeProfile, "id" | "full_name" | "city" | "profile_photo_url">): Suggestion {
  return { id: home.id, name: home.full_name, detail: home.city, photo: home.profile_photo_url, href: homeProfilePath(home.id) };
}

/**
 * Rows in the order a list of suggestions shows them. The API matches the words anywhere (a name, a breed, a city,
 * a bio); someone typing a name expects that name first. So: names that start with the words, then names with a
 * later word that starts with them, then names that hold them anywhere, then the rest, each group in the order the
 * API sent it.
 */
export function rankByName<T>(typed: string, rows: readonly T[], nameOf: (row: T) => string): T[] {
  const words = typed.trim().toLowerCase();
  if (words === "") return [...rows];
  const rank = (row: T) => {
    const name = nameOf(row).toLowerCase();
    if (name.startsWith(words)) return 0;
    if (name.split(/\s+/).some((part) => part.startsWith(words))) return 1;
    return name.includes(words) ? 2 : 3;
  };
  return rows
    .map((row, index) => ({ row, index, rank: rank(row) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ row }) => row);
}

/** A name cut around the first place the typed words are in it, whatever the case, so that part can be bold. */
export function splitAtMatch(name: string, typed: string): [before: string, match: string, after: string] {
  const words = typed.trim();
  const at = words === "" ? -1 : name.toLowerCase().indexOf(words.toLowerCase());
  if (at === -1) return [name, "", ""];
  return [name.slice(0, at), name.slice(at, at + words.length), name.slice(at + words.length)];
}

/** How many things narrow the results, for the Filters button on phones. The search box has its own place. */
export function countPanelFilters(filters: BrowseFilters): number {
  const picked = Object.values(filters.picked).reduce((total, values) => total + values.length, 0);
  return picked + (filters.province ? 1 : 0);
}

/** The filters with the panel emptied: the search and the sort stay as they are. */
export function clearPanelFilters(filters: BrowseFilters): BrowseFilters {
  return { ...filters, province: "", picked: {}, page: 1 };
}
