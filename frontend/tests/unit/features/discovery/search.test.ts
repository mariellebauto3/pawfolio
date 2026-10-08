import { describe, expect, it } from "vitest";
import { resultCount, searchFromUrl, searchHref, searchKindFromUrl, searchPageFromUrl } from "@/features/discovery/schemas/search";

describe("the search page's URL (DS-03)", () => {
  it("reads the words, trimmed and capped", () => {
    expect(searchFromUrl({ q: "  quezon city " })).toBe("quezon city");
    expect(searchFromUrl({ q: ["aspin", "puspin"] })).toBe("aspin");
    expect(searchFromUrl({ q: "a".repeat(300) })).toHaveLength(100);
    expect(searchFromUrl({})).toBe("");
  });

  it("reads the open kind and its page, and falls back to the overview and page 1", () => {
    expect(searchKindFromUrl({ type: "homes" })).toBe("homes");
    expect(searchKindFromUrl({ type: "accounts" })).toBeNull();
    expect(searchKindFromUrl({})).toBeNull();
    expect(searchPageFromUrl({ page: "3" })).toBe(3);
    expect(searchPageFromUrl({ page: "0" })).toBe(1);
    expect(searchPageFromUrl({ page: "two" })).toBe(1);
  });

  it("writes the address of a search, a kind and a page", () => {
    expect(searchHref("quezon city")).toBe("/search?q=quezon+city");
    expect(searchHref("aspin", "pets")).toBe("/search?q=aspin&type=pets");
    expect(searchHref("aspin", "pets", 3)).toBe("/search?q=aspin&type=pets&page=3");
    // The overview has no pages.
    expect(searchHref("aspin", null, 3)).toBe("/search?q=aspin");
  });

  it("counts results", () => {
    expect(resultCount(1)).toBe("1 result");
    expect(resultCount(12)).toBe("12 results");
  });
});
