import { describe, expect, it } from "vitest";
import {
  BROWSE_PAGE_SIZE,
  type BrowseFilters,
  NO_FILTERS,
  activeFilters,
  browseApiQuery,
  browseFiltersFromUrl,
  browseHref,
  browseKindFor,
  browseSearchParams,
  clearPanelFilters,
  countPanelFilters,
} from "@/features/discovery/schemas/browse-filters";

const filters = (change: Partial<BrowseFilters>): BrowseFilters => ({ ...NO_FILTERS, ...change });

describe("who browses what", () => {
  it("gives humans pets and pets homes; admins have no Browse", () => {
    expect(browseKindFor("human")).toBe("pets");
    expect(browseKindFor("pet")).toBe("homes");
    expect(browseKindFor("admin")).toBeNull();
  });
});

describe("reading Browse from the URL", () => {
  it("shows everything, best match first, when the URL holds nothing", () => {
    expect(browseFiltersFromUrl("pets", {})).toEqual(NO_FILTERS);
  });

  it("reads lists written as a,b and as repeated parameters, in the order the options are listed", () => {
    expect(browseFiltersFromUrl("pets", { species: "cat,dog" }).picked.species).toEqual(["dog", "cat"]);
    // What a plain GET form sends before the page's JavaScript has loaded.
    expect(browseFiltersFromUrl("pets", { species: ["cat", "dog"] }).picked.species).toEqual(["dog", "cat"]);
  });

  it("drops values it doesn't know instead of failing", () => {
    const read = browseFiltersFromUrl("pets", {
      species: "dragon,dog",
      size: "huge",
      province: "Atlantis",
      sort: "price",
      page: "-3",
      status: "adopted_hired",
    });
    expect(read).toEqual(filters({ picked: { species: ["dog"] } }));
  });

  it("keeps a pet's filters and a home's filters apart", () => {
    expect(browseFiltersFromUrl("homes", { species: "dog", home_type: "condo" }).picked).toEqual({ home_type: ["condo"] });
    expect(browseFiltersFromUrl("pets", { species: "dog", home_type: "condo" }).picked).toEqual({ species: ["dog"] });
  });

  it("takes one answer for the questions that have one", () => {
    expect(browseFiltersFromUrl("homes", { kids: "no,yes", other_pets: "cats" }).picked).toEqual({ other_pets: ["cats"], kids: ["yes"] });
    // "Any" is sent as an empty value by the plain form.
    expect(browseFiltersFromUrl("homes", { kids: "" }).picked).toEqual({});
  });

  it("trims the search, caps its length and reads the page", () => {
    const read = browseFiltersFromUrl("pets", { q: `  ${"a".repeat(150)}  `, page: "3", province: "Metro Manila", sort: "newest" });
    expect(read.search).toHaveLength(100);
    expect(read).toMatchObject({ page: 3, province: "Metro Manila", sort: "newest" });
  });
});

describe("writing Browse to the URL", () => {
  it("is /browse alone when nothing narrows the results", () => {
    expect(browseHref("pets", NO_FILTERS)).toBe("/browse");
  });

  it("leaves out defaults and writes lists as a,b", () => {
    const href = browseHref("pets", filters({ search: " aspin ", province: "Metro Manila", picked: { species: ["dog", "cat"], age: [] }, page: 2 }));
    expect(href).toBe("/browse?q=aspin&province=Metro+Manila&species=dog%2Ccat&page=2");
  });

  it("round-trips through the URL", () => {
    const original = filters({ search: "quezon", sort: "newest", page: 4, picked: { home_type: ["house", "condo"], kids: ["yes"] } });
    const params = Object.fromEntries(new URL(browseHref("homes", original), "http://pawfolio.invalid").searchParams);
    expect(browseFiltersFromUrl("homes", params)).toEqual(original);
  });

  it("hands Pagination the same parameters", () => {
    expect(browseSearchParams("pets", filters({ picked: { size: ["small"] }, page: 2 }))).toEqual({ size: "small", page: "2" });
  });
});

describe("asking the API", () => {
  it("always sends the sort and the page size, and nothing that isn't set", () => {
    expect(browseApiQuery("pets", NO_FILTERS)).toEqual({ sort: "best_match", per_page: BROWSE_PAGE_SIZE });
  });

  it("sends lists as a,b under the API's own names", () => {
    const query = browseApiQuery("homes", filters({ search: "pasig", page: 2, picked: { other_pets: ["none"], kids: ["no"], activity_level: ["active", "very_active"] } }));
    expect(query).toMatchObject({ q: "pasig", page: 2, has_other_pets: "none", has_kids: "no", activity_level: "active,very_active" });
    expect(query).not.toHaveProperty("kids");
    expect(query).not.toHaveProperty("other_pets");
  });

  it("never sends a status: the API decides which pets are listed (FR27)", () => {
    expect(browseApiQuery("pets", browseFiltersFromUrl("pets", { status: "in_process" }))).not.toHaveProperty("status");
  });
});

describe("active filter chips", () => {
  const picked = filters({ search: "aspin", province: "Rizal", page: 3, picked: { species: ["dog", "cat"], good_with: ["kids"] } });

  it("has one chip for each thing that narrows the results", () => {
    expect(activeFilters("pets", picked).map((chip) => chip.label)).toEqual(["“aspin”", "Rizal", "Dog", "Cat", "Kids"]);
    expect(activeFilters("pets", NO_FILTERS)).toEqual([]);
  });

  it("removes only its own filter and goes back to page 1", () => {
    const cat = activeFilters("pets", picked).find((chip) => chip.label === "Cat");
    expect(cat?.href).toBe("/browse?q=aspin&province=Rizal&species=dog&good_with=kids");
  });

  it("names the question on a one-answer filter, where the answer alone says nothing", () => {
    const chips = activeFilters("homes", filters({ picked: { kids: ["yes"], other_pets: ["none"] } }));
    expect(chips.map((chip) => chip.label)).toEqual(["Other pets: None", "Kids at home: Yes"]);
  });
});

describe("the filter panel", () => {
  it("counts what the panel holds, not the search box", () => {
    expect(countPanelFilters(filters({ search: "aspin", province: "Rizal", picked: { species: ["dog", "cat"] } }))).toBe(3);
    expect(countPanelFilters(NO_FILTERS)).toBe(0);
  });

  it("clears the panel and keeps the search and the sort", () => {
    const cleared = clearPanelFilters(filters({ search: "aspin", sort: "newest", province: "Rizal", page: 2, picked: { species: ["dog"] } }));
    expect(cleared).toEqual(filters({ search: "aspin", sort: "newest" }));
  });
});
