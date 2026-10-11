import type { IsoDateTime } from "@/types/api";

// What the activity log endpoints answer (docs/api/community-reports-and-admin.md, "Activity logs"; LG-01…LG-04,
// FR41). The log is only ever read: there is nothing here to send (SEC-LOG-04). A member's own activity comes with
// less than an admin reads: no reason, no id, and "An admin" in place of a name.

/** The kinds of entry, as the API names them (`activity_logs.type`). */
export const ACTIVITY_TYPES = ["verification", "account", "status_change", "request", "meet_and_greet", "adoption", "feed", "profile", "moderation", "announcement", "security", "system"] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

/** Who acted. `system` is an entry nobody is the actor of: a scheduled job, a status the system changed. */
export const ACTOR_ROLES = ["admin", "pet", "human", "system"] as const;
export type ActorRole = (typeof ACTOR_ROLES)[number];

export type ActivityActor = {
  /** The account's id, for an admin only; null for the system and in a member's own activity. */
  id: number | null;
  display_name: string;
  role: ActorRole;
  /** The reader did this themselves. */
  is_you: boolean;
};

/** The page an entry's subject has. A member is only ever led to their own request. */
export type ActivityTarget = { kind: "account" | "request" | "report"; id: number };

export type ActivityEntry = {
  id: number;
  type: ActivityType;
  /** What happened, as the API names it: `adoption_request_approved`. The screens put it into words. */
  action: string;
  actor: ActivityActor;
  /** The kind of record it was about (`AdoptionRequest`), and that record in a few words ("Mochi to Ana Santos"). */
  subject_type: string | null;
  subject_label: string | null;
  target: ActivityTarget | null;
  before_value: string | null;
  after_value: string | null;
  /** Why, for an admin; always null in a member's own activity. */
  reason: string | null;
  /** "Edge on Windows": where a sign-in came from. */
  device: string | null;
  created_at: IsoDateTime;
};

/** One entry in full, for an admin (LG-04). */
export type ActivityEntryDetail = ActivityEntry & {
  /** The browser's own description of itself, as it was sent. */
  user_agent: string | null;
};
