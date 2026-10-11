// Where a view of a profile came from, as the API records it (`profile_views.source`): the page the visitor was on
// when they opened it. A pet reads the totals on My stats (AN-01); nobody reads who the visitors were.

export const VIEW_SOURCES = ["matches", "browse", "search", "bookmarks", "feed", "direct"] as const;
export type ViewSource = (typeof VIEW_SOURCES)[number];
