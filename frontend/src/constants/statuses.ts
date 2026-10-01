// Display names for the API's status values. The names are the proposal's exact words and are the keys of
// STATUS_TONES, so `<StatusBadge status={PET_STATUS_LABELS[pet.status]} />` picks the right badge tone.

import type { StatusName } from "@/constants/status-badges";
import type { AccountStatus, PetStatus, ReportStatus, RequestStatus } from "@/types/statuses";

export const ACCOUNT_STATUS_LABELS = {
  pending_verification: "Pending Verification",
  active: "Active",
  denied: "Denied",
  suspended: "Suspended",
  deactivated: "Deactivated",
} as const satisfies Record<AccountStatus, StatusName>;

export const PET_STATUS_LABELS = {
  draft: "Draft",
  looking_for_a_home: "Looking for a Home",
  in_process: "In Process",
  adopted_hired: "Hired",
} as const satisfies Record<PetStatus, StatusName>;

export const REQUEST_STATUS_LABELS = {
  sent: "Sent",
  on_hold: "On Hold",
  approved: "Approved",
  meet_scheduled: "Meet Scheduled",
  awaiting_decision: "Awaiting Decision",
  adopted: "Adopted",
  declined: "Declined",
  not_adopted: "Not Adopted",
  withdrawn: "Withdrawn",
  closed: "Closed",
  expired: "Expired",
} as const satisfies Record<RequestStatus, StatusName>;

export const REPORT_STATUS_LABELS = {
  open: "Open",
  resolved: "Resolved",
} as const satisfies Record<ReportStatus, StatusName>;
