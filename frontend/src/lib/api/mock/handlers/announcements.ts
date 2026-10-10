import { MOCK_PERSONAS } from "@/lib/api/mock/personas";
import { type MockRoute, paginate, route, validationFailed } from "@/lib/api/mock/router";

// The admin's announcements in mock mode (docs/api/community-reports-and-admin.md, "Announcements"; NT-04, NT-05),
// with the API's answers and its rules. What is published lives in memory, so a reload brings these back, and a page
// rendered on the server doesn't see what the browser published. All of it is made up (SEC-PRIV-06).

const TITLE_MAX = 160;
const MESSAGE_MAX = 2000;
const DAY_MS = 24 * 60 * 60 * 1000;
const AUDIENCES = ["everyone", "pets", "humans"] as const;
type Audience = (typeof AUDIENCES)[number];

type Row = {
  id: number;
  title: string;
  message: string;
  audience: Audience;
  publish_at: string;
  published_at: string | null;
  admin_name: string;
  created_at: string;
};

const STARTED_AT = Date.now();
const ago = (days: number) => new Date(STARTED_AT - days * DAY_MS).toISOString();
const past = (id: number, title: string, message: string, audience: Audience, admin: string, days: number): Row => ({ id, title, message, audience, publish_at: ago(days), published_at: ago(days), admin_name: admin, created_at: ago(days) });

// The LoFi's past announcements (NT-04), without the one about request threads, which Pawfolio doesn't have.
const ROWS: Row[] = [
  past(1, "Reminder: keep vet records up to date", "A recent vet record helps a home say yes. Add yours to your resume's health section.", "pets", "admin.jess", 56),
  past(2, "Meet & Greet availability is live", "Add the times you can meet, so an approved pet can book one.", "humans", "admin.mark", 39),
  past(3, "Pawfolio Adoption Week starts Oct 10!", "A week of adoption stories on the feed. Share yours.", "everyone", "admin.jess", 15),
];

const resource = (row: Row) => ({ ...row, status: row.published_at ? "published" : "scheduled" });

/** Active Pet and Human personas by audience, as the API counts Active accounts. */
function audienceCounts(): Record<Audience, number> {
  const active = [...new Map(Object.values(MOCK_PERSONAS).flatMap((account) => (account && account.status === "active" && account.role !== "admin" ? [[account.id, account.role] as const] : []))).values()];
  const pets = active.filter((role) => role === "pet").length;
  return { everyone: active.length, pets, humans: active.length - pets };
}

const field = (body: unknown, name: string): unknown => (typeof body === "object" && body !== null ? (body as Record<string, unknown>)[name] : undefined);
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

export const announcementRoutes: MockRoute[] = [
  route(
    "GET",
    "/admin/announcements",
    ({ query }) => {
      const rows = [...ROWS].sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id).map(resource);
      const page = paginate(rows, query, "/api/v1/admin/announcements");
      return { status: 200, body: { ...page, meta: { ...page.meta, audience_counts: audienceCounts() } } };
    },
    "admin",
  ),

  route(
    "POST",
    "/admin/announcements",
    ({ body, account }) => {
      const title = text(field(body, "title"));
      const message = text(field(body, "message"));
      const audience = field(body, "audience");
      const publishAt = field(body, "publish_at");
      const errors: Record<string, string> = {};

      if (title === "") errors.title = "Enter a title.";
      else if (title.length > TITLE_MAX) errors.title = `Keep the title to ${TITLE_MAX} characters or fewer.`;
      if (message === "") errors.message = "Enter a message.";
      else if (message.length > MESSAGE_MAX) errors.message = `Keep the message to ${MESSAGE_MAX} characters or fewer.`;
      if (!(AUDIENCES as readonly unknown[]).includes(audience)) errors.audience = "Choose who the announcement is for.";

      // No time means now; a time has to be still ahead, and within a year.
      let scheduled: string | null = null;
      if (publishAt !== undefined && publishAt !== null) {
        const at = typeof publishAt === "string" ? new Date(publishAt).getTime() : Number.NaN;
        if (Number.isNaN(at)) errors.publish_at = "Enter a valid date and time.";
        else if (at <= Date.now()) errors.publish_at = "Choose a time that is still ahead, or publish now.";
        else if (at >= Date.now() + 365 * DAY_MS) errors.publish_at = "Choose a time within the next year.";
        else scheduled = new Date(at).toISOString();
      }
      if (Object.keys(errors).length > 0) return validationFailed(errors);

      // Who publishes is the session's, and whether it is published is worked out here: neither is read from the body.
      const now = new Date().toISOString();
      const row: Row = {
        id: Math.max(0, ...ROWS.map((candidate) => candidate.id)) + 1,
        title,
        message,
        audience: audience as Audience,
        publish_at: scheduled ?? now,
        published_at: scheduled ? null : now,
        admin_name: account?.display_name ?? "admin.jess",
        created_at: now,
      };
      ROWS.push(row);
      return { status: 201, body: { data: { ...resource(row), recipients_notified: scheduled ? 0 : audienceCounts()[row.audience] } } };
    },
    "admin",
  ),
];
