// Pages a visitor has opened are kept in the tab's memory for a short while (`staleTimes` in next.config.ts), so
// going back to one is immediate and asks the API nothing. A write can make any of them out of date: a bookmark
// saved on a card belongs on the Bookmarks page, a request that was sent on the Requests page. So every write the
// API accepts drops all of them, by having the server render the open page again (`router.refresh()` is the only
// way the browser has to clear what Next.js keeps). Kept free of React and of the DOM so the timing is covered by
// a unit test; `PageCacheSync` (src/providers/page-cache-sync.tsx) connects it to the router.

/** Writes that come in a burst (three likes in a row) are answered by two renders, not one for each. */
export const REFRESH_GAP_MS = 1_000;

type Options = {
  gapMs?: number;
  now?: () => number;
};

export type PageRefresher = ReturnType<typeof createPageRefresher>;

export function createPageRefresher(refresh: () => void, { gapMs = REFRESH_GAP_MS, now = Date.now }: Options = {}) {
  let lastRefreshAt = Number.NEGATIVE_INFINITY;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function run(): void {
    timer = null;
    lastRefreshAt = now();
    refresh();
  }

  return {
    /**
     * A write was accepted. The first one is answered at once, so no page from before it is shown again; the ones
     * that follow within the gap share one more render when it ends, which carries the last of them.
     */
    noteWrite(): void {
      if (timer !== null) return;
      const wait = lastRefreshAt + gapMs - now();
      if (wait <= 0) run();
      else timer = setTimeout(run, wait);
    },
    stop(): void {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    },
  };
}
