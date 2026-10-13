import { expect, it } from "vitest";
import { accountSuggestions, memberSuggestions, petFinderSuggestions, requestSuggestions } from "@/components/forms/read-search-suggestions";

it("keeps database capitalization across member and admin suggestion labels", () => {
  expect(memberSuggestions({ pets: [{ id: 1, name: "Ana Pet" }], home_profiles: [{ id: 1, full_name: "Ana Santos" }], posts: [{ id: 1, title: "An Adoption" }] })).toEqual([
    { id: "pet-1", name: "Ana Pet" }, { id: "home-1", name: "Ana Santos" }, { id: "post-1", name: "An Adoption" },
  ]);
  expect(accountSuggestions([{ account_id: 1, display_name: "Ana Santos" }])).toEqual([{ id: "1", name: "Ana Santos" }]);
  expect(petFinderSuggestions([{ pet: { id: 2, name: "Ana Pet" } }])).toEqual([{ id: "2", name: "Ana Pet" }]);
});

it("deduplicates request parties and safely handles missing profiles", () => {
  const row = { pet: { id: 1, name: "Ana Pet" }, home_profile: { id: 1, full_name: "Ana Santos" } };
  expect(requestSuggestions([row, row, { pet: null }])).toEqual([{ id: "pet-1", name: "Ana Pet" }, { id: "home-1", name: "Ana Santos" }]);
  expect(memberSuggestions(null)).toEqual([]);
});
