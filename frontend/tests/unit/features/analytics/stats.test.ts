import { describe, expect, it } from "vitest";
import { getMemberStats, getPlatformDashboard, toHistoryRequest } from "@/features/analytics/api/stats";
import {
  accountStatusSegments,
  averageDays,
  dayLabel,
  daysSince,
  monthLabels,
  niceMax,
  oldestWaitNote,
  petStatusBars,
  plural,
  requestOutcomeBars,
  scoreBandColumns,
  scoreBandLabel,
  thisWeekNote,
  viewSourceBars,
  waitingNames,
} from "@/features/analytics/schemas/stats";
import { type Transport, createApiClient } from "@/lib/api/core";
import { isApiError } from "@/lib/api/errors";
import { MOCK_PERSONA_COOKIE, createMockTransport } from "@/lib/api/mock/transport";
import { viewSourceFromReferer } from "@/lib/utils/view-source";
import { REQUEST_STATUSES } from "@/types/statuses";

// Stats and the platform dashboard (AN-01…AN-03): how the API's numbers are read, grouped and put into words, and
// the calls against the mock API, which answers in the shapes of docs/api/community-reports-and-admin.md.

function as(persona: string) {
  return createApiClient(createMockTransport({ readCookie: (name) => (name === MOCK_PERSONA_COOKIE ? persona : null), writePersona: () => {}, latencyMs: 0 }));
}

function answering(body: unknown, status = 200) {
  const calls: { method: string; path: string; query?: unknown }[] = [];
  const transport: Transport = async ({ method, path, query }) => {
    calls.push({ method, path, query });
    return { status, body, retryAfter: null };
  };
  return { client: createApiClient(transport), calls };
}

const failure = async (run: () => Promise<unknown>) => {
  try {
    await run();
  } catch (problem) {
    if (isApiError(problem)) return problem;
    throw problem;
  }
  throw new Error("Expected the call to fail.");
};

const NOW = new Date("2026-10-10T04:00:00.000Z");
const zeroOutcomes = Object.fromEntries(REQUEST_STATUSES.map((status) => [status, 0])) as Record<(typeof REQUEST_STATUSES)[number], number>;

describe("words for numbers", () => {
  it("counts in the singular and the plural", () => {
    expect(plural(1, "view")).toBe("1 view");
    expect(plural(0, "view")).toBe("0 views");
    expect(plural(3, "open report")).toBe("3 open reports");
  });

  it("says what a week added, or that it added nothing", () => {
    expect(thisWeekNote(32)).toBe("+32 this week");
    expect(thisWeekNote(0)).toBe("None this week");
  });

  it("writes a day and a month without a clock", () => {
    expect(dayLabel("2026-10-10")).toBe("Oct 10");
    expect(dayLabel("2026-01-01")).toBe("Jan 1");
    expect(monthLabels([{ month: "2026-05" }, { month: "2026-10" }])).toEqual(["May", "Oct"]);
    // Across a new year the months say which year they are.
    expect(monthLabels([{ month: "2025-12" }, { month: "2026-01" }])).toEqual(["Dec ’25", "Jan ’26"]);
  });

  it("names a match score band", () => {
    expect(scoreBandLabel({ from: 90, to: 100 })).toBe("90–100%");
    expect(scoreBandLabel({ from: 0, to: 59 })).toBe("Below 60%");
  });

  it("says how long the front of the verification queue has waited", () => {
    expect(oldestWaitNote("2026-10-08T03:00:00.000Z", NOW)).toBe("Oldest has waited 2 days");
    expect(oldestWaitNote("2026-10-09T03:00:00.000Z", NOW)).toBe("Oldest has waited 1 day");
    expect(oldestWaitNote("2026-10-10T03:00:00.000Z", NOW)).toBe("Oldest came in today");
    expect(oldestWaitNote(null, NOW)).toBe("Nobody is waiting");
    expect(daysSince("not a date", NOW)).toBeNull();
    // A clock that runs behind the server's.
    expect(daysSince("2026-10-11T03:00:00.000Z", NOW)).toBe(0);
  });

  it("names who has waited longest", () => {
    expect(waitingNames(["Pepper"], 1)).toBe("Pepper");
    expect(waitingNames(["Pepper", "Carla Mendoza"], 2)).toBe("Pepper and Carla Mendoza");
    expect(waitingNames(["Pepper", "Carla Mendoza", "Tofu"], 4)).toBe("Pepper, Carla Mendoza and 2 more");
    expect(waitingNames([], 0)).toBe("");
  });

  it("writes an average with one decimal only when it has one", () => {
    expect(averageDays(23)).toBe("23");
    expect(averageDays(23.4)).toBe("23.4");
  });
});

describe("what the charts draw", () => {
  it("lists where views came from, most first", () => {
    const bars = viewSourceBars({ matches: 2, browse: 9, search: 0, bookmarks: 0, feed: 4, direct: 2 });
    expect(bars.map((bar) => [bar.label, bar.value])).toEqual([
      ["Browse", 9],
      ["Community feed", 4],
      ["Pets for You", 2],
      ["A link or the address bar", 2],
      ["Search", 0],
      ["Bookmarks", 0],
    ]);
  });

  it("groups a human's requests by how they ended", () => {
    const bars = requestOutcomeBars({ ...zeroOutcomes, sent: 1, on_hold: 1, approved: 2, awaiting_decision: 1, adopted: 1, declined: 2, not_adopted: 1, withdrawn: 1, expired: 1, closed: 2 });
    expect(bars.map((bar) => [bar.label, bar.value])).toEqual([
      ["Open", 5],
      ["Adopted", 1],
      ["Declined", 3],
      ["Withdrawn", 1],
      ["Expired or closed", 3],
    ]);
    // Adopted is the good news; what is over is quiet.
    expect(bars.map((bar) => bar.tone)).toEqual(["primary", "accent", "muted", "muted", "muted"]);
  });

  it("orders the match score bands weakest first", () => {
    const columns = scoreBandColumns([
      { from: 90, to: 100, count: 1 },
      { from: 0, to: 59, count: 4 },
      { from: 80, to: 89, count: 2 },
    ]);
    expect(columns.map((column) => [column.label, column.value])).toEqual([
      ["Below 60%", 4],
      ["80–89%", 2],
      ["90–100%", 1],
    ]);
  });

  it("orders pets as they move and accounts with Active first", () => {
    expect(petStatusBars({ draft: 1, looking_for_a_home: 2, in_process: 3, adopted_hired: 4 }).map((bar) => bar.label)).toEqual(["Draft", "Looking for a Home", "In Process", "Hired"]);
    const segments = accountStatusSegments({ total: 10, active: 6, pending_verification: 1, denied: 1, suspended: 1, deactivated: 1, active_pets: 2, active_humans: 4 });
    expect(segments.map((segment) => segment.label)).toEqual(["Active", "Pending Verification", "Suspended", "Denied", "Deactivated"]);
  });

  it("rounds a chart's scale up to a number that halves cleanly", () => {
    expect(niceMax([])).toBe(4);
    expect(niceMax([0, 1])).toBe(4);
    expect(niceMax([7])).toBe(10);
    expect(niceMax([11])).toBe(20);
    expect(niceMax([34])).toBe(40);
    expect(niceMax([148])).toBe(200);
    expect(niceMax([100])).toBe(100);
  });
});

describe("where a view came from", () => {
  const HOST = "pawfolio.example";

  it("names the page of this site the visitor was on", () => {
    expect(viewSourceFromReferer(`https://${HOST}/matches`, HOST)).toBe("matches");
    expect(viewSourceFromReferer(`https://${HOST}/browse?species=dog`, HOST)).toBe("browse");
    expect(viewSourceFromReferer(`https://${HOST}/search?q=mochi`, HOST)).toBe("search");
    expect(viewSourceFromReferer(`https://${HOST}/bookmarks`, HOST)).toBe("bookmarks");
    expect(viewSourceFromReferer(`https://${HOST}/feed`, HOST)).toBe("feed");
    expect(viewSourceFromReferer(`https://${HOST}/posts/12`, HOST)).toBe("feed");
  });

  it("counts everything else as a direct visit", () => {
    expect(viewSourceFromReferer(`https://${HOST}/requests/3`, HOST)).toBe("direct");
    expect(viewSourceFromReferer(`https://${HOST}/matchesandmore`, HOST)).toBe("direct");
    // Another site that happens to have a /matches page.
    expect(viewSourceFromReferer("https://evil.example/matches", HOST)).toBe("direct");
    expect(viewSourceFromReferer("not an address", HOST)).toBe("direct");
    expect(viewSourceFromReferer(null, HOST)).toBe("direct");
    expect(viewSourceFromReferer(`https://${HOST}/matches`, null)).toBe("direct");
  });
});

describe("reading what the API answered", () => {
  it("reads a request for the history, and leaves out a row that isn't one", () => {
    expect(toHistoryRequest({ id: 7, status: "approved", pet: { id: 1, name: "Mochi" }, home_profile: { id: 2, full_name: "Ana Santos" }, sent_at: "2026-10-01T02:00:00.000000Z", updated_at: "nope" })).toEqual({
      id: 7,
      status: "approved",
      pet_name: "Mochi",
      home_name: "Ana Santos",
      sent_at: "2026-10-01T02:00:00.000000Z",
      updated_at: null,
    });
    expect(toHistoryRequest({ id: 7, status: "paid", pet: { name: "Mochi" }, home_profile: { full_name: "Ana Santos" } })).toBeNull();
    expect(toHistoryRequest({ id: 7, status: "sent", pet: null, home_profile: { full_name: "Ana Santos" } })).toBeNull();
  });

  it("reads a number that isn't a whole count as 0, and never guesses the quiz", async () => {
    const { client } = answering({ data: { role: "human", has_completed_quiz: "yes", tiles: { matches: { total: -3, strong: "5" }, requests: { total: 2.5 } }, request_outcomes: { sent: 2 } } });
    const stats = await getMemberStats(client);
    expect(stats.role).toBe("human");
    if (stats.role !== "human") return;
    expect(stats.has_completed_quiz).toBe(false);
    expect(stats.tiles.matches).toEqual({ total: 0, strong: 0 });
    expect(stats.tiles.requests).toEqual({ total: 0, need_action: 0 });
    expect(stats.tiles.adopted).toEqual({ total: 0, names: [] });
    expect(stats.request_outcomes.sent).toBe(2);
    expect(stats.request_outcomes.adopted).toBe(0);
  });

  it("refuses an answer that names no role", async () => {
    expect((await failure(() => getMemberStats(answering({ data: { role: "admin" } }).client))).message).toBe("We couldn't load your stats. Please try again.");
    expect((await failure(() => getMemberStats(answering({}).client))).kind).toBe("server");
    expect((await failure(() => getPlatformDashboard(answering({ data: {} }).client))).message).toBe("We couldn't load the dashboard. Please try again.");
  });

  it("asks for the account's own stats and nothing else", async () => {
    const { client, calls } = answering({ data: { role: "pet" } });
    await getMemberStats(client);
    expect(calls).toEqual([{ method: "GET", path: "/stats", query: undefined }]);
  });
});

describe("against the mock API", () => {
  it("answers a pet with its own numbers", async () => {
    const stats = await getMemberStats(as("pet"));
    expect(stats.role).toBe("pet");
    if (stats.role !== "pet") return;
    expect(stats.views_over_time).toHaveLength(30);
    expect(stats.tiles.views.total).toBeGreaterThan(0);
    expect(stats.request_history.length).toBeGreaterThan(0);
    expect(stats.request_history.every((request) => request.pet_name === "Mochi")).toBe(true);
    expect(stats.tiles.requests.total).toBe(stats.request_history.length);
  });

  it("answers a human with matches and requests", async () => {
    const stats = await getMemberStats(as("human"));
    expect(stats.role).toBe("human");
    if (stats.role !== "human") return;
    expect(stats.match_score_distribution.reduce((sum, band) => sum + band.count, 0)).toBe(stats.tiles.matches.total);
    expect(Object.values(stats.request_outcomes).reduce((sum, value) => sum + value, 0)).toBe(stats.tiles.requests.total);
    expect(stats.request_history.every((request) => request.home_name === "Ana Santos")).toBe(true);
  });

  it("keeps stats to pets and humans, and the dashboard to admins", async () => {
    expect((await failure(() => getMemberStats(as("admin")))).status).toBe(403);
    expect((await failure(() => getMemberStats(as("signed-out")))).status).toBe(401);
    expect((await failure(() => getMemberStats(as("pet-pending")))).kind).toBe("account_not_active");
    expect((await failure(() => getPlatformDashboard(as("pet")))).status).toBe(403);
    expect((await failure(() => getPlatformDashboard(as("signed-out")))).status).toBe(401);
  });

  it("answers an admin with the platform's numbers and six months of trends", async () => {
    const dashboard = await getPlatformDashboard(as("admin"));
    expect(dashboard.trends).toHaveLength(6);
    expect(dashboard.tiles.accounts.active).toBe(dashboard.tiles.accounts.active_pets + dashboard.tiles.accounts.active_humans);
    expect(dashboard.tiles.adoptions_this_month).toBe(dashboard.trends[5].adopted);
    expect(dashboard.needs_attention.pending_verifications[0]).toMatchObject({ display_name: "Kulit", role: "pet" });
  });
});
