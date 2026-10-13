import type { SearchSuggestion } from "./search-suggestions";

type Row = Record<string, unknown>;
const record = (value: unknown): Row => typeof value === "object" && value !== null ? value as Row : {};
const rows = (value: unknown): Row[] => Array.isArray(value) ? value.map(record) : [];
function names(value: unknown, field: string): SearchSuggestion[] {
  return rows(value).flatMap((row) => typeof row[field] === "string" ? [{ id: String(row.id ?? row.account_id), name: row[field] as string }] : []);
}
export const memberSuggestions = (data: unknown): SearchSuggestion[] => {
  const result = record(data);
  return [...names(result.pets, "name").map((row) => ({ ...row, id: `pet-${row.id}` })),
    ...names(result.home_profiles, "full_name").map((row) => ({ ...row, id: `home-${row.id}` })),
    ...names(result.posts, "title").map((row) => ({ ...row, id: `post-${row.id}` }))];
};
export const accountSuggestions = (data: unknown) => names(data, "display_name");
export const petFinderSuggestions = (data: unknown): SearchSuggestion[] => rows(data).flatMap((row) => names([record(row.pet)], "name"));
export const requestSuggestions = (data: unknown): SearchSuggestion[] => {
  const matches = rows(data).flatMap((row) => [...names([record(row.pet)], "name").map((item) => ({ ...item, id: `pet-${item.id}` })),
    ...names([record(row.home_profile)], "full_name").map((item) => ({ ...item, id: `home-${item.id}` }))]);
  return [...new Map(matches.map((item) => [item.id, item])).values()];
};
