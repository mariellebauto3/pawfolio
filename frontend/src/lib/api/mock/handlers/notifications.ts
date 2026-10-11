import { type MockRoute, fail, ok, paginate, route, validationFailed } from "@/lib/api/mock/router";
import { NOTIFICATION_CATEGORIES, type NotificationCategory, type NotificationUrgency } from "@/types/notification";

// Notifications in mock mode (docs/api/notifications.md): each account reads its own, newest first, by tab, with
// the same answers as the API. What is marked as read lives in memory, so it is back to these after a reload, and
// a page rendered on the server doesn't see what the browser marked.

type Row = {
  id: string;
  user_id: number;
  type: string;
  category: NotificationCategory | null;
  title: string;
  body: string;
  urgency: NotificationUrgency;
  action_url: string | null;
  created_at: string;
  read_at: string | null;
};

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const STARTED_AT = Date.now();
const ago = (ms: number) => new Date(STARTED_AT - ms).toISOString();

type Seed = [title: string, body: string, type: string, category: NotificationCategory, action_url: string | null, agoMs: number, state?: "unread" | "urgent"];

// The lists of the LoFi (NT-02, NT-03), pointed at the fixtures' own requests. All of it is made up (SEC-PRIV-06).
const SEEDS: Record<number, Seed[]> = {
  // Mochi (account 1): Meet Scheduled with Ana Santos (request 1), On Hold with Paolo Garcia (2), Declined by Marco Reyes (5).
  1: [
    ["Paolo Garcia invited you to apply!", "“Your resume made us smile. The kids already cleared a spot on the couch.” Paolo Garcia invited Mochi to apply.", "invite_sent", "requests", "/invites", 2 * HOUR_MS, "unread"],
    ["Meet & Greet confirmed", "Ana Santos confirmed your Meet & Greet. Open the request for the time and the place.", "meet_greet_booked", "meet_and_greets", "/requests/1", DAY_MS, "unread"],
    ["Meet & Greet reminder (tomorrow)", "Your Meet & Greet with Ana Santos is tomorrow.", "meet_greet_booked", "meet_and_greets", "/requests/1", DAY_MS + 2 * HOUR_MS],
    ["Request on hold", "Your request to Paolo Garcia is paused while another request is in process.", "request_under_review", "requests", "/requests/2", 2 * DAY_MS],
    ["Ana Santos approved your request", "Book a Meet & Greet within 14 days.", "request_approved", "requests", "/requests/1", 3 * DAY_MS],
    ["Marco Reyes declined your request", "You can apply to this home again after 30 days.", "request_declined", "requests", "/requests/5", 7 * DAY_MS],
    ["Account approved", "Welcome to Pawfolio! Complete your resume to go live.", "verification_approved", "account", "/me", 14 * DAY_MS],
  ],
  // Ana Santos (account 2): Siopao's decision is due (request 7), Pepper's request is new (3), Mochi's is in progress (1).
  2: [
    ["Decision needed for Siopao", "Your Meet & Greet with Siopao has passed. Please confirm your decision so Siopao isn’t left waiting.", "request_under_review", "meet_and_greets", "/requests/7", HOUR_MS, "urgent"],
    ["New adoption request", "Pepper sent you an adoption request.", "request_received", "requests", "/requests/3", DAY_MS, "unread"],
    ["Meet & Greet reminder (tomorrow)", "Your Meet & Greet with Mochi is tomorrow.", "meet_greet_booked", "meet_and_greets", "/requests/1", DAY_MS + 3 * HOUR_MS],
    ["Mochi booked a Meet & Greet", "Confirm the time, or propose another.", "meet_greet_booked", "meet_and_greets", "/requests/1", 4 * DAY_MS],
    ["Pawfolio Adoption Week starts Oct 10!", "A week of adoption stories on the feed. Share yours.", "announcement", "account", "/feed", 3 * DAY_MS],
    ["Luna has been adopted", "You adopted Luna. Welcome to the Furparent club!", "request_approved", "requests", "/requests/6", 16 * DAY_MS],
  ],
  // Luna (account 9), adopted by Ana Santos.
  9: [["You got Hired!", "Ana Santos adopted you. Your profile is now an alumni profile, and your other open requests were closed.", "request_approved", "requests", "/requests/6", 16 * DAY_MS]],
};

const ROWS: Row[] = Object.entries(SEEDS).flatMap(([userId, seeds]) =>
  seeds.map(([title, body, type, category, action_url, agoMs, state], index): Row => ({
    id: `01MOCKNOTIFICATION${userId.padStart(4, "0")}${String(index).padStart(4, "0")}`,
    user_id: Number(userId),
    type,
    category,
    title,
    body,
    urgency: state === "urgent" ? "warning" : "info",
    action_url,
    created_at: ago(agoMs),
    read_at: state ? null : ago(agoMs - HOUR_MS / 2),
  })),
);

// NotificationResource: `data` and `sender` are sent by the API too, and read by no screen.
const resource = ({ id, type, category, title, body, urgency, action_url, created_at, read_at }: Row) => ({
  id,
  type,
  category,
  title,
  body,
  data: null,
  is_read: read_at !== null,
  is_dismissed: false,
  urgency,
  action_url,
  sender: "system",
  created_at,
});

const own = (accountId: number | undefined) => ROWS.filter((row) => row.user_id === accountId).sort((a, b) => b.created_at.localeCompare(a.created_at));

export const notificationRoutes: MockRoute[] = [
  route("GET", "/notifications", ({ query, account }) => {
    let rows = own(account?.id);
    const category = query.category;
    if (category !== undefined && category !== null && category !== "all") {
      // A value that is no tab is refused, as the API does (SEC-INPUT-03).
      if (!(NOTIFICATION_CATEGORIES as readonly unknown[]).includes(category)) return validationFailed({ category: "Choose All, Requests, Meet & Greets or Account." });
      rows = rows.filter((row) => row.category === category);
    }
    // Recent is the last 7 days, earlier everything before them, however old; anything else is refused.
    const period = query.period;
    if (period !== undefined && period !== null && period !== "all") {
      if (period !== "recent" && period !== "earlier") return validationFailed({ period: "Choose All, Recent or Earlier." });
      const cutoff = Date.now() - 7 * DAY_MS;
      rows = rows.filter((row) => (Date.parse(row.created_at) >= cutoff) === (period === "recent"));
    }
    return { status: 200, body: paginate(rows.map(resource), query, "/api/v1/notifications") };
  }),

  route("GET", "/notifications/unread-count", ({ account }) => ok({ unread_count: own(account?.id).filter((row) => row.read_at === null).length })),

  route("POST", "/notifications/read-all", ({ account }) => {
    const unread = own(account?.id).filter((row) => row.read_at === null);
    const now = new Date().toISOString();
    unread.forEach((row) => {
      row.read_at = now;
    });
    return ok({ marked_read_count: unread.length });
  }),

  route("POST", "/notifications/:notificationId/read", ({ params, account }) => {
    // Another account's notification is answered like one that doesn't exist (SEC-AUTHZ-04).
    const row = own(account?.id).find((candidate) => candidate.id === params.notificationId);
    if (!row) return fail(404, "Notification not found.");
    row.read_at ??= new Date().toISOString();
    return ok(resource(row));
  }),
];
