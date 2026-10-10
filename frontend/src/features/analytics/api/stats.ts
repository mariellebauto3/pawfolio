import type { ApiClient } from "@/lib/api/core";
import { isRecord, isText, unexpected } from "@/lib/api/readers";
import type { ApiResource } from "@/types/api";
import { VIEW_SOURCES } from "@/types/profile-view";
import { ACCOUNT_STATUSES, PET_STATUSES, type PetStatus, REQUEST_STATUSES, type RequestStatus } from "@/types/statuses";
import {
  type DayCount,
  type HistoryRequest,
  type HumanStats,
  type MemberStats,
  type MonthTrend,
  type PendingVerification,
  type PetStats,
  type PlatformDashboard,
  type ScoreBand,
} from "../types/stats";

// The analytics calls (docs/api/community-reports-and-admin.md, "Analytics"; AN-01…AN-03, FR30, FR40). Both are
// read from Server Components with `getServerApi()` and change nothing. Whose numbers `/stats` answers with is the
// session's to say, never a parameter (SEC-AUTHZ-02), and the API checks the admin role on the dashboard itself
// (SEC-AUTHZ-07). A number the answer doesn't carry is shown as 0, never guessed.

const STATS_PROBLEM = "We couldn't load your stats. Please try again.";
const DASHBOARD_PROBLEM = "We couldn't load the dashboard. Please try again.";

/** A whole, non-negative count; anything else reads as 0. */
const count = (value: unknown): number => (typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0);
const amount = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0);
const record = (value: unknown): Record<string, unknown> => (isRecord(value) ? value : {});
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const dateOrNull = (value: unknown) => (isText(value) && !Number.isNaN(new Date(value).getTime()) ? value : null);
const name = (value: unknown) => (isRecord(value) && isText(value.name) ? value.name : isRecord(value) && isText(value.full_name) ? value.full_name : "");

function counts<Key extends string>(value: unknown, keys: readonly Key[]): Record<Key, number> {
  const source = record(value);
  return Object.fromEntries(keys.map((key) => [key, count(source[key])])) as Record<Key, number>;
}

/** A request as a stats page lists it, or null when the row isn't one and is left out. */
export function toHistoryRequest(row: unknown): HistoryRequest | null {
  if (!isRecord(row) || typeof row.id !== "number" || !(REQUEST_STATUSES as readonly unknown[]).includes(row.status)) return null;
  const petName = name(row.pet);
  const homeName = name(row.home_profile);
  if (!petName || !homeName) return null;
  return { id: row.id, status: row.status as RequestStatus, pet_name: petName, home_name: homeName, sent_at: dateOrNull(row.sent_at), updated_at: dateOrNull(row.updated_at) };
}

const history = (value: unknown) => list(value).flatMap((row) => toHistoryRequest(row) ?? []);

function toDays(value: unknown): DayCount[] {
  return list(value).flatMap((row) => (isRecord(row) && isText(row.date) && /^\d{4}-\d{2}-\d{2}$/.test(row.date) ? [{ date: row.date, count: count(row.count) }] : []));
}

function toBands(value: unknown): ScoreBand[] {
  return list(value).flatMap((row) => (isRecord(row) && typeof row.from === "number" && typeof row.to === "number" ? [{ from: row.from, to: row.to, count: count(row.count) }] : []));
}

function toPetStats(data: Record<string, unknown>): PetStats {
  const tiles = record(data.tiles);
  return {
    role: "pet",
    pet_status: (PET_STATUSES as readonly unknown[]).includes(data.pet_status) ? (data.pet_status as PetStatus) : null,
    tiles: {
      views: counts(tiles.views, ["total", "this_week"]),
      bookmarks: counts(tiles.bookmarks, ["total", "this_week"]),
      requests: counts(tiles.requests, ["total", "open"]),
      invites: counts(tiles.invites, ["total", "live"]),
    },
    views_over_time: toDays(data.views_over_time),
    views_by_source: counts(data.views_by_source, VIEW_SOURCES),
    request_history: history(data.request_history),
  };
}

function toHumanStats(data: Record<string, unknown>): HumanStats {
  const tiles = record(data.tiles);
  const adopted = record(tiles.adopted);
  return {
    role: "human",
    // Only a plain `true`: the quiz is what makes matches, so a screen never claims it was taken.
    has_completed_quiz: data.has_completed_quiz === true,
    tiles: {
      matches: counts(tiles.matches, ["total", "strong"]),
      bookmarks: counts(tiles.bookmarks, ["total"]),
      requests: counts(tiles.requests, ["total", "need_action"]),
      adopted: { total: count(adopted.total), names: list(adopted.names).filter(isText) },
    },
    match_score_distribution: toBands(data.match_score_distribution),
    request_outcomes: counts(data.request_outcomes, REQUEST_STATUSES),
    request_history: history(data.request_history),
  };
}

/** The signed-in pet's or human's own numbers (AN-01, AN-02). 403 for an admin, who has none. */
export async function getMemberStats(client: ApiClient): Promise<MemberStats> {
  const data = (await client.get<ApiResource<unknown>>("/stats"))?.data;
  if (!isRecord(data)) throw unexpected(STATS_PROBLEM);
  if (data.role === "pet") return toPetStats(data);
  if (data.role === "human") return toHumanStats(data);
  throw unexpected(STATS_PROBLEM);
}

function toTrends(value: unknown): MonthTrend[] {
  return list(value).flatMap((row) =>
    isRecord(row) && isText(row.month) && /^\d{4}-\d{2}$/.test(row.month) ? [{ month: row.month, sent: count(row.sent), approved: count(row.approved), adopted: count(row.adopted) }] : [],
  );
}

function toPending(value: unknown): PendingVerification[] {
  return list(value).flatMap((row) =>
    isRecord(row) && typeof row.id === "number" && isText(row.display_name) && (row.role === "pet" || row.role === "human")
      ? [{ id: row.id, role: row.role, display_name: row.display_name, submitted_at: dateOrNull(row.submitted_at) }]
      : [],
  );
}

/** The platform's numbers as they stand, and what waits for an admin (AN-03). */
export async function getPlatformDashboard(client: ApiClient): Promise<PlatformDashboard> {
  const data = (await client.get<ApiResource<unknown>>("/admin/dashboard"))?.data;
  if (!isRecord(data) || !isRecord(data.tiles)) throw unexpected(DASHBOARD_PROBLEM);
  const tiles = data.tiles;

  return {
    tiles: {
      accounts: counts(tiles.accounts, [...ACCOUNT_STATUSES, "total", "active_pets", "active_humans"]),
      verification_queue_count: count(tiles.verification_queue_count),
      oldest_verification_at: dateOrNull(tiles.oldest_verification_at),
      open_reports_count: count(tiles.open_reports_count),
      pets_by_status: counts(tiles.pets_by_status, PET_STATUSES),
      requests: counts(tiles.requests, ["total", "open", "in_process", "adopted", "overdue", "expiring_soon"]),
      meet_and_greets: counts(tiles.meet_and_greets, ["total", "booked", "confirmed", "ended", "upcoming_week"]),
      adoptions_count: count(tiles.adoptions_count),
      adoptions_this_month: count(tiles.adoptions_this_month),
      adoptions_last_month: count(tiles.adoptions_last_month),
      average_days_to_adoption: amount(tiles.average_days_to_adoption),
    },
    trends: toTrends(data.trends),
    needs_attention: { pending_verifications: toPending(record(data.needs_attention).pending_verifications) },
  };
}
