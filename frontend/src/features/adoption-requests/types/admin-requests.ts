import type { AdoptionRequest } from "@/types/adoption-request";
import type { Resolution } from "@/types/adoption-resolution";
import type { IsoDateTime } from "@/types/api";
import type { MeetAndGreet } from "@/types/meet-and-greet";
import type { AccountStatus } from "@/types/statuses";

// What the admin's request endpoints answer (docs/api/adoption-and-meet-greet.md, "The admin's monitor"): every
// request on the platform, read-only (RQ-18, RQ-19, MG-15, MG-16, FR36). None of them carries a phone number or an
// address: monitoring a request doesn't need them (SEC-PRIV-02).

/** A request as the monitor lists it. */
export type MonitoredRequest = AdoptionRequest & {
  /** When anything about it last changed. */
  updated_at: IsoDateTime | null;
  /** Still Awaiting Decision 7 days after the meeting time passed (§5.4, MG-16). The API decides, not the clock here. */
  is_overdue: boolean;
  /** Its latest Meet & Greet booking, whatever became of it; null when none was ever booked. */
  meeting: MeetAndGreet | null;
};

/** The two accounts of a request, for the links to their pages (AC-07). */
export type RequestParties = {
  pet_user_id: number | null;
  pet_email: string | null;
  pet_account_status: AccountStatus | null;
  human_user_id: number | null;
  human_email: string | null;
  human_account_status: AccountStatus | null;
};

/** Which side a reminder would go to. Null when nobody has a step to take, so there is nobody to remind. */
export type ReminderSide = "pet" | "human";

export type RequestReminder = {
  waiting_on: ReminderSide | null;
  last_sent_at: IsoDateTime | null;
  /** False when nobody waits, or one went out in the last 24 hours: the API would refuse another (SEC-FE-05). */
  can_send: boolean;
};

/** One request's record (RQ-19). */
export type MonitoredRequestDetail = MonitoredRequest & {
  parties: RequestParties;
  reminder: RequestReminder;
  /** What admins changed on it through Resolve adoption issue, oldest first (NFR9). */
  resolutions: Resolution[];
};

/** Who was reminded, for the toast. */
export type ReminderSent = { recipient: ReminderSide; recipient_name: string | null };
