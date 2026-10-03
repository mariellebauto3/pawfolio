// Dates from the API are UTC. Pawfolio is used in the Philippines, so they are shown in Philippine time wherever the
// page is rendered, on the server or in the browser, and both write the same text.

const TIME_ZONE = "Asia/Manila";

const DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: TIME_ZONE });
const TIME = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: TIME_ZONE });

function parse(iso: string): Date | null {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "Sep 13, 2026"; empty when the value isn't a date. */
export function formatDate(iso: string): string {
  const date = parse(iso);
  return date ? DATE.format(date) : "";
}

/** "Sep 13, 2026, 2:48 PM"; empty when the value isn't a date. */
export function formatDateTime(iso: string): string {
  const date = parse(iso);
  // Newer ICU data puts a narrow no-break space before AM/PM; a plain space reads the same and matches everywhere.
  return date ? `${DATE.format(date)}, ${TIME.format(date).replace(/ /g, " ")}` : "";
}
