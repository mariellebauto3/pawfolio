import { Alert } from "@/components/feedback/alert";
import { DENIAL_REASON_LABELS } from "@/constants/verification";
import type { AccountStatusInfo } from "@/types/account-status";

type Props = {
  info: Pick<AccountStatusInfo, "denial_reason" | "reason">;
  className?: string;
};

// Why an admin denied (AU-20) or suspended (AU-21) the account: the reason they chose and what they wrote. Their
// words are rendered as plain text (SEC-FE-01). Renders nothing when there is no reason to show.
export function AdminReason({ info, className }: Props) {
  // "Other" says nothing on its own; the admin's message carries the reason.
  const chosen = info.denial_reason && info.denial_reason !== "other" ? DENIAL_REASON_LABELS[info.denial_reason] : null;
  if (!chosen && !info.reason) return null;

  return (
    <Alert tone="warning" title="Reason from admin" className={className}>
      {chosen && <p className="font-bold">{chosen}</p>}
      {info.reason && <p className="break-words whitespace-pre-line">{info.reason}</p>}
    </Alert>
  );
}
