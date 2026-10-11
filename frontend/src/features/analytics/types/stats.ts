import type { IsoDate, IsoDateTime } from "@/types/api";
import type { ViewSource } from "@/types/profile-view";
import type { AccountStatus, PetStatus, RequestStatus } from "@/types/statuses";

// What the analytics endpoints answer (docs/api/community-reports-and-admin.md, "Analytics"): a member's own numbers
// (AN-01, AN-02, FR30) and the platform's, for admins (AN-03, FR40). Counts and dates only: none of it names who
// viewed or bookmarked a profile, and no request here carries a phone number or an address (SEC-PRIV-02).

/** Views on one day in the Philippines. */
export type DayCount = { date: IsoDate; count: number };

/** A request as a stats page lists it: who it is with, where it stands and when it last moved. */
export type HistoryRequest = {
  id: number;
  status: RequestStatus;
  pet_name: string;
  home_name: string;
  sent_at: IsoDateTime | null;
  updated_at: IsoDateTime | null;
};

/** How a pet's resume is doing (AN-01). */
export type PetStats = {
  role: "pet";
  /** Null when the API named a status this screen doesn't know. */
  pet_status: PetStatus | null;
  tiles: {
    views: { total: number; this_week: number };
    bookmarks: { total: number; this_week: number };
    requests: { total: number; open: number };
    /** `live`: the ones still on the Invites to Apply page. */
    invites: { total: number; live: number };
  };
  /** The last 30 days, oldest first. */
  views_over_time: DayCount[];
  views_by_source: Record<ViewSource, number>;
  /** The latest 10, newest first. */
  request_history: HistoryRequest[];
};

/** Matches whose score is between `from` and `to`, both included. */
export type ScoreBand = { from: number; to: number; count: number };

/** A human's matches and requests (AN-02). */
export type HumanStats = {
  role: "human";
  has_completed_quiz: boolean;
  tiles: {
    /** The pets on Pets for You; `strong` are the ones at 80% or more. */
    matches: { total: number; strong: number };
    bookmarks: { total: number };
    /** `need_action`: the ones where the human has the next step. */
    requests: { total: number; need_action: number };
    adopted: { total: number; names: string[] };
  };
  /** Best band first. */
  match_score_distribution: ScoreBand[];
  request_outcomes: Record<RequestStatus, number>;
  request_history: HistoryRequest[];
};

export type MemberStats = PetStats | HumanStats;

/** Requests sent and approved, and adoptions, in one month ("2026-10") in the Philippines. */
export type MonthTrend = { month: string; sent: number; approved: number; adopted: number };

export type PendingVerification = { id: number; role: "pet" | "human"; display_name: string; submitted_at: IsoDateTime | null };

/** The platform's numbers as they stand (AN-03). */
export type PlatformDashboard = {
  tiles: {
    accounts: Record<AccountStatus, number> & { total: number; active_pets: number; active_humans: number };
    verification_queue_count: number;
    /** How long the account at the front of the queue has waited; null when nobody waits. */
    oldest_verification_at: IsoDateTime | null;
    open_reports_count: number;
    pets_by_status: Record<PetStatus, number>;
    requests: { total: number; open: number; in_process: number; adopted: number; overdue: number; expiring_soon: number };
    meet_and_greets: { total: number; booked: number; confirmed: number; ended: number; upcoming_week: number };
    adoptions_count: number;
    adoptions_this_month: number;
    adoptions_last_month: number;
    average_days_to_adoption: number;
  };
  /** The last 6 months, oldest first. */
  trends: MonthTrend[];
  needs_attention: {
    /** The accounts that have waited longest, for the line under the count. */
    pending_verifications: PendingVerification[];
  };
};
