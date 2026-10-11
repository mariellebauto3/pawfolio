import { describe, expect, it } from "vitest";
import { pageFromUrl } from "@/lib/utils/page-param";

describe("the page number in a list's URL", () => {
  it("reads a whole number of 1 or more", () => {
    expect(pageFromUrl("2")).toBe(2);
    expect(pageFromUrl("120")).toBe(120);
    expect(pageFromUrl(["3", "9"])).toBe(3);
  });

  it("falls back to page 1 for anything else", () => {
    for (const value of [undefined, "", "0", "-2", "2.5", "two", "1e3", "2 ", "99999999", []]) {
      expect(pageFromUrl(value)).toBe(1);
    }
  });
});
