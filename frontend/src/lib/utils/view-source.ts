import type { ViewSource } from "@/types/profile-view";

// The pages a profile is opened from, by the start of their path. Anything else is a direct visit: a link someone
// sent, a notification, the address bar.
const SOURCES: [prefix: string, source: ViewSource][] = [
  ["/matches", "matches"],
  ["/browse", "browse"],
  ["/search", "search"],
  ["/bookmarks", "bookmarks"],
  ["/feed", "feed"],
  ["/posts", "feed"],
];

/**
 * Where a visitor came from, read from the request's Referer header: the page of this site they were on. Only the
 * path is looked at, and only when the page is on this site (`host`); the address itself is never sent on, so no
 * search words or other query values leave the page (SEC-FE-04).
 */
export function viewSourceFromReferer(referer: string | null | undefined, host: string | null | undefined): ViewSource {
  if (!referer || !host) return "direct";
  let from: URL;
  try {
    from = new URL(referer);
  } catch {
    return "direct";
  }
  if (from.host !== host) return "direct";
  return SOURCES.find(([prefix]) => from.pathname === prefix || from.pathname.startsWith(`${prefix}/`))?.[1] ?? "direct";
}
