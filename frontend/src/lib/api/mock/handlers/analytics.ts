import { ADOPTION_REQUESTS } from "@/lib/api/mock/fixtures/adoption-requests";
import { MATCH_SCORES } from "@/lib/api/mock/fixtures/match-scores";
import { PETS } from "@/lib/api/mock/fixtures/pets";
import { type MockRoute, fail, ok, route } from "@/lib/api/mock/router";
import type { AdoptionRequest } from "@/types/adoption-request";
import { REQUEST_STATUSES } from "@/types/statuses";

// Stats and the platform dashboard in mock mode (docs/api/community-reports-and-admin.md, "Analytics"; AN-01…AN-03),
// in the shapes the API answers with. The requests are the fixtures' own, so the history matches the Requests page;
// the views and the platform's counts are made up (SEC-PRIV-06).

const DAY_MS = 24 * 60 * 60 * 1000;
const HISTORY_LIMIT = 10;
const OPEN = ["sent", "on_hold", "approved", "meet_scheduled", "awaiting_decision"];
const BANDS = [[90, 100], [80, 89], [70, 79], [60, 69], [0, 59]] as const;

/** A day in the Philippines, as the API names it: "2026-10-10". */
const philippineDay = (at: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
const philippineMonth = (at: Date) => philippineDay(at).slice(0, 7);

// The same wave every time, so a screen looks the same on every reload: quiet weekdays, busier towards today.
const VIEWS = [2, 4, 3, 5, 1, 0, 2, 6, 4, 3, 7, 5, 2, 1, 4, 8, 6, 5, 3, 2, 6, 9, 7, 4, 5, 3, 8, 11, 6, 4];

function viewsOverTime(now: Date) {
  return VIEWS.map((count, index) => ({ date: philippineDay(new Date(now.getTime() - (VIEWS.length - 1 - index) * DAY_MS)), count }));
}

function history(requests: AdoptionRequest[]) {
  const newest = (request: AdoptionRequest) => Date.parse(request.sent_at ?? "") || 0;
  const latest = (request: AdoptionRequest) => [request.closed_at, request.awaiting_decision_at, request.meet_scheduled_at, request.approved_at, request.sent_at].find(Boolean) ?? null;
  return [...requests]
    .sort((a, b) => newest(b) - newest(a) || b.id - a.id)
    .slice(0, HISTORY_LIMIT)
    .map((request) => ({ ...request, updated_at: latest(request) }));
}

function months(now: Date) {
  // The 15th of each month, so a short month or a time zone never skips one.
  const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 15));
  const rows = [
    [18, 9, 2],
    [24, 12, 3],
    [21, 13, 5],
    [30, 17, 4],
    [34, 20, 7],
    [27, 15, 6],
  ];
  return rows.map(([sent, approved, adopted], index) => {
    const month = new Date(base);
    month.setUTCMonth(base.getUTCMonth() - (rows.length - 1 - index));
    return { month: philippineMonth(month), sent, approved, adopted };
  });
}

export const analyticsRoutes: MockRoute[] = [
  route("GET", "/stats", ({ account }) => {
    if (!account || account.role === "admin" || account.profile_id === null) return fail(403, "Stats are for Pet and Human accounts.");
    const now = new Date();

    if (account.role === "pet") {
      const pet = PETS.find((candidate) => candidate.id === account.profile_id);
      const requests = ADOPTION_REQUESTS.filter((request) => request.pet.id === account.profile_id);
      const views = viewsOverTime(now);
      const recent = views.slice(-7).reduce((sum, day) => sum + day.count, 0);
      return ok({
        role: "pet",
        pet_status: pet?.status ?? "draft",
        tiles: {
          views: { total: 148, this_week: recent },
          bookmarks: { total: 23, this_week: 5 },
          requests: { total: requests.length, open: requests.filter((request) => OPEN.includes(request.status)).length },
          invites: { total: 2, live: 1 },
        },
        views_over_time: views,
        views_by_source: { browse: 31, search: 22, matches: 64, bookmarks: 9, feed: 14, direct: 8 },
        request_history: history(requests),
      });
    }

    const requests = ADOPTION_REQUESTS.filter((request) => request.home_profile.id === account.profile_id);
    const scores = Object.entries(MATCH_SCORES).flatMap(([pair, score]) => (pair.endsWith(`:${account.profile_id}`) ? [score] : []));
    const adopted = requests.filter((request) => request.status === "adopted");
    return ok({
      role: "human",
      has_completed_quiz: true,
      tiles: {
        matches: { total: scores.length, strong: scores.filter((score) => score >= 80).length },
        bookmarks: { total: 4 },
        requests: { total: requests.length, need_action: requests.filter((request) => request.status === "sent" || request.status === "awaiting_decision").length },
        adopted: { total: adopted.length, names: adopted.slice(0, 3).map((request) => request.pet.name) },
      },
      match_score_distribution: BANDS.map(([from, to]) => ({ from, to, count: scores.filter((score) => score >= from && score <= to).length })),
      request_outcomes: Object.fromEntries(REQUEST_STATUSES.map((status) => [status, requests.filter((request) => request.status === status).length])),
      request_history: history(requests),
    });
  }),

  route(
    "GET",
    "/admin/dashboard",
    () => {
      const now = new Date();
      const trends = months(now);
      const overdue = ADOPTION_REQUESTS.filter((request) => request.overdue_flagged_at !== null);
      return ok({
        tiles: {
          accounts: { total: 341, active: 312, pending_verification: 4, denied: 9, suspended: 5, deactivated: 11, pets: 150, humans: 191, active_pets: 139, active_humans: 173 },
          verification_queue_count: 4,
          oldest_verification_at: new Date(now.getTime() - DAY_MS).toISOString(),
          open_reports_count: 3,
          pets_by_status: { draft: 14, looking_for_a_home: 87, in_process: 12, adopted_hired: 37 },
          requests: { total: 154, open: 41, in_process: 12, adopted: 27, overdue: overdue.length, expiring_soon: 3 },
          meet_and_greets: { total: 63, booked: 4, confirmed: 5, ended: 54, upcoming_week: 9 },
          adoptions_count: 27,
          adoptions_this_month: trends[trends.length - 1].adopted,
          adoptions_last_month: trends[trends.length - 2].adopted,
          average_days_to_adoption: 23.4,
        },
        trends,
        needs_attention: {
          pending_verifications: [
            { id: 4, role: "pet", display_name: "Kulit", submitted_at: new Date(now.getTime() - DAY_MS).toISOString() },
            { id: 5, role: "human", display_name: "Carla Mendoza", submitted_at: new Date(now.getTime() - DAY_MS / 2).toISOString() },
          ],
          open_reports: [],
          overdue_requests: history(overdue),
        },
      });
    },
    "admin",
  ),
];
