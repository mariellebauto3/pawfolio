import type { IsoDateTime, Paginated } from "@/types/api";

// The admin's announcements, mirroring `announcements` (backend migration 2026_09_30_000009) as the API sends them
// (docs/api/community-reports-and-admin.md, "Announcements"; NT-04, NT-05, FR39). An announcement is written once:
// there is no edit and no delete, and who published it is the session's, never the form's.

/** Who an announcement is for. */
export const ANNOUNCEMENT_AUDIENCES = ["everyone", "pets", "humans"] as const;
export type AnnouncementAudience = (typeof ANNOUNCEMENT_AUDIENCES)[number];

/** Published: its audience has it. Scheduled: it goes out at `publish_at`. */
export type AnnouncementStatus = "published" | "scheduled";

export type AdminAnnouncement = {
  id: number;
  /** The admin's words, rendered as text (SEC-FE-01). */
  title: string;
  message: string;
  audience: AnnouncementAudience;
  status: AnnouncementStatus;
  /** When it goes out, for a scheduled one. */
  publish_at: IsoDateTime | null;
  published_at: IsoDateTime | null;
  /** Null when the admin's account is gone. */
  admin_name: string | null;
  created_at: IsoDateTime;
};

/** How many Active accounts each audience is right now. An audience the API didn't count is left out. */
export type AudienceCounts = Partial<Record<AnnouncementAudience, number>>;

/** A page of announcements, newest first, with the audience counts the publish dialog shows. */
export type AnnouncementPage = Paginated<AdminAnnouncement> & { audienceCounts: AudienceCounts };

/** What the API takes: `publish_at` null to publish now, or a time still ahead to schedule it. */
export type NewAnnouncement = {
  title: string;
  message: string;
  audience: AnnouncementAudience;
  publish_at: IsoDateTime | null;
};

/** The announcement as it was stored, with how many accounts got an alert (0 for a scheduled one). */
export type StoredAnnouncement = AdminAnnouncement & { recipients_notified: number | null };
