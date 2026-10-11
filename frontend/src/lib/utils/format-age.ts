/** "8 months", "1 year", "5 years", "1 year 2 months" from the pet's approximate age in months. */
export function formatAgeMonths(months: number): string {
  if (!Number.isFinite(months) || months < 0) return "";
  const count = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;
  const years = Math.floor(months / 12);
  const rest = Math.round(months % 12);
  if (years === 0) return count(rest, "month");
  return rest === 0 ? count(years, "year") : `${count(years, "year")} ${count(rest, "month")}`;
}
