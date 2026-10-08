import { describe, expect, it } from "vitest";
import {
  ALL_MATCHES,
  HOME_QUICK_FILTERS,
  MATCHES_PAGE_SIZE,
  PET_QUICK_FILTERS,
  matchKindFor,
  matchSearchParams,
  matchViewFromUrl,
  matchesApiQuery,
  matchesHref,
  pickedQuickFilter,
} from "@/features/matching/schemas/match-view";

describe("who is matched with what", () => {
  it("gives humans pets, pets homes and admins nothing", () => {
    expect(matchKindFor("human")).toBe("pets");
    expect(matchKindFor("pet")).toBe("homes");
    expect(matchKindFor("admin")).toBeNull();
  });
});

describe("reading the URL (MT-01, MT-02)", () => {
  it("shows everything, best match first, for a bare address", () => {
    expect(matchViewFromUrl("pets", {})).toEqual(ALL_MATCHES);
  });

  it("reads the quick filter, the sort and the page", () => {
    expect(matchViewFromUrl("pets", { show: "dogs", sort: "newest", page: "3" })).toEqual({ show: "dogs", sort: "newest", page: 3 });
    expect(matchViewFromUrl("homes", { show: "with-kids" })).toEqual({ ...ALL_MATCHES, show: "with-kids" });
  });

  it("drops what it doesn't know, so a hand-edited link still shows matches", () => {
    expect(matchViewFromUrl("pets", { show: "dragons", sort: "price", page: "-2" })).toEqual(ALL_MATCHES);
    expect(matchViewFromUrl("pets", { page: "1e3" }).page).toBe(1);
    expect(matchViewFromUrl("pets", { page: "0" }).page).toBe(1);
    expect(matchViewFromUrl("pets", { page: "99999999999" }).page).toBe(1);
  });

  it("keeps a pet's filter out of a human's list and the other way round", () => {
    expect(matchViewFromUrl("pets", { show: "houses" }).show).toBe("");
    expect(matchViewFromUrl("homes", { show: "dogs" }).show).toBe("");
  });

  it("takes the first value of a parameter given twice", () => {
    expect(matchViewFromUrl("pets", { show: ["cats", "dogs"], page: ["2", "9"] })).toEqual({ ...ALL_MATCHES, show: "cats", page: 2 });
  });
});

describe("writing the URL", () => {
  it("leaves out everything that is at its default", () => {
    expect(matchesHref(ALL_MATCHES)).toBe("/matches");
    expect(matchSearchParams(ALL_MATCHES)).toEqual({});
  });

  it("writes what was picked", () => {
    expect(matchesHref({ show: "no-other-pets", sort: "newest", page: 2 })).toBe("/matches?show=no-other-pets&sort=newest&page=2");
    expect(matchSearchParams({ show: "dogs", sort: "best_match", page: 1 })).toEqual({ show: "dogs" });
  });

  it("reads back what it wrote", () => {
    const view = { show: "senior", sort: "newest", page: 4 } as const;
    const written = Object.fromEntries(new URL(matchesHref(view), "http://pawfolio.test").searchParams);
    expect(matchViewFromUrl("pets", written)).toEqual(view);
  });
});

describe("asking the API", () => {
  it("asks for a page of twelve, best match first", () => {
    expect(matchesApiQuery("pets", ALL_MATCHES)).toEqual({ sort: "best_match", page: undefined, per_page: MATCHES_PAGE_SIZE });
  });

  it("turns each quick filter into the API's own filter", () => {
    const paging = Object.keys(matchesApiQuery("pets", ALL_MATCHES));
    const asked = (kind: "pets" | "homes", show: string) =>
      Object.fromEntries(Object.entries(matchesApiQuery(kind, { ...ALL_MATCHES, show })).filter(([name]) => !paging.includes(name)));
    expect(asked("pets", "dogs")).toEqual({ species: "dog" });
    expect(asked("pets", "cats")).toEqual({ species: "cat" });
    expect(asked("pets", "small")).toEqual({ size: "small" });
    expect(asked("pets", "senior")).toEqual({ age: "senior" });
    expect(asked("homes", "houses")).toEqual({ home_type: "house" });
    expect(asked("homes", "condos")).toEqual({ home_type: "condo" });
    expect(asked("homes", "with-kids")).toEqual({ has_kids: "yes" });
    expect(asked("homes", "no-other-pets")).toEqual({ has_other_pets: "none" });
  });

  it("sends the page only past the first", () => {
    expect(matchesApiQuery("homes", { ...ALL_MATCHES, sort: "newest", page: 3 })).toMatchObject({ sort: "newest", page: 3 });
  });

  it("names every quick filter differently", () => {
    for (const filters of [PET_QUICK_FILTERS, HOME_QUICK_FILTERS]) {
      expect(new Set(filters.map((filter) => filter.id)).size).toBe(filters.length);
      expect(filters.every((filter) => /^[a-z-]+$/.test(filter.id))).toBe(true);
    }
    expect(pickedQuickFilter("pets", { ...ALL_MATCHES, show: "small" })?.noun).toBe("small pets");
    expect(pickedQuickFilter("pets", ALL_MATCHES)).toBeUndefined();
  });
});
