// Which badge tone each status uses (docs/design/hifi/README.md, "Status badges").
// Shape says whether a status is still moving; colour says what kind of ending it is.
// Names are the display names from the proposal; the API's snake_case values map to these.

export type BadgeTone = "progress" | "celebrate" | "attention" | "closed";

export const STATUS_TONES = {
  // Account
  "Pending Verification": "progress",
  Resubmitted: "progress",
  Active: "progress",
  Denied: "closed",
  Suspended: "closed",
  Deactivated: "closed",
  // Pet
  Draft: "progress",
  "Looking for a Home": "progress",
  "In Process": "progress",
  Hired: "celebrate",
  // Adoption request
  Sent: "progress",
  "On Hold": "progress",
  Approved: "progress",
  "Meet Scheduled": "progress",
  "Awaiting Decision": "attention",
  Adopted: "celebrate",
  Declined: "closed",
  "Not Adopted": "closed",
  Withdrawn: "closed",
  Expired: "closed",
  // Human
  "Open to Adopt": "progress",
  Furparent: "celebrate",
  // Report
  Open: "progress",
  Resolved: "closed",
} as const satisfies Record<string, BadgeTone>;

export type StatusName = keyof typeof STATUS_TONES;
